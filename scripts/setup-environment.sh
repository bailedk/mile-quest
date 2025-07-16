#!/bin/bash

# Mile Quest Environment Setup Script
# This script sets up environment variables for different deployment stages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is installed and configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Run 'aws configure' first."
        exit 1
    fi

    print_status "AWS CLI is installed and configured"
}

# Function to get CloudFormation stack outputs
get_stack_outputs() {
    local stage=$1
    local stack_name=$2
    
    print_status "Getting outputs from stack: $stack_name"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs' \
        --output json 2>/dev/null || echo "[]"
}

# Function to get SSM parameter value
get_ssm_parameter() {
    local parameter_name=$1
    
    aws ssm get-parameter \
        --name "$parameter_name" \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo ""
}

# Function to create environment file from template
create_env_file() {
    local stage=$1
    local template_file="$PROJECT_ROOT/.env.$stage"
    local output_file="$PROJECT_ROOT/.env.$stage.populated"
    
    if [[ ! -f "$template_file" ]]; then
        print_error "Template file not found: $template_file"
        return 1
    fi
    
    print_status "Creating populated environment file for $stage"
    
    # Copy template
    cp "$template_file" "$output_file"
    
    # Get stack outputs
    local cognito_outputs=$(get_stack_outputs "$stage" "MileQuest-$stage-Cognito")
    local database_outputs=$(get_stack_outputs "$stage" "MileQuest-$stage-Database")
    local api_outputs=$(get_stack_outputs "$stage" "MileQuest-$stage-Api")
    
    # Extract values from outputs
    local user_pool_id=$(echo "$cognito_outputs" | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue' 2>/dev/null || echo "")
    local user_pool_client_id=$(echo "$cognito_outputs" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue' 2>/dev/null || echo "")
    local db_endpoint=$(echo "$database_outputs" | jq -r '.[] | select(.OutputKey=="DatabaseEndpoint") | .OutputValue' 2>/dev/null || echo "")
    local api_gateway_url=$(echo "$api_outputs" | jq -r '.[] | select(.OutputKey=="ApiGatewayUrl") | .OutputValue' 2>/dev/null || echo "")
    
    # Get database password from Secrets Manager
    local db_credentials_arn=$(echo "$database_outputs" | jq -r '.[] | select(.OutputKey=="DatabaseCredentialsArn") | .OutputValue' 2>/dev/null || echo "")
    local db_password=""
    if [[ -n "$db_credentials_arn" ]]; then
        db_password=$(aws secretsmanager get-secret-value \
            --secret-id "$db_credentials_arn" \
            --query 'SecretString' \
            --output text 2>/dev/null | jq -r '.password' 2>/dev/null || echo "")
    fi
    
    # Replace placeholders in environment file
    if [[ -n "$user_pool_id" ]]; then
        sed -i.bak "s/\${USER_POOL_ID_$(echo $stage | tr '[:lower:]' '[:upper:]')}/$user_pool_id/g" "$output_file"
    fi
    
    if [[ -n "$user_pool_client_id" ]]; then
        sed -i.bak "s/\${USER_POOL_CLIENT_ID_$(echo $stage | tr '[:lower:]' '[:upper:]')}/$user_pool_client_id/g" "$output_file"
    fi
    
    if [[ -n "$db_endpoint" ]]; then
        sed -i.bak "s/\${DB_ENDPOINT}/$db_endpoint/g" "$output_file"
    fi
    
    if [[ -n "$db_password" ]]; then
        sed -i.bak "s/\${DB_PASSWORD}/$db_password/g" "$output_file"
    fi
    
    # Get AWS account ID
    local aws_account_id=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || echo "")
    if [[ -n "$aws_account_id" ]]; then
        sed -i.bak "s/\${AWS_ACCOUNT_ID}/$aws_account_id/g" "$output_file"
    fi
    
    # Clean up backup files
    rm -f "$output_file.bak"
    
    print_status "Environment file created: $output_file"
    print_warning "Review the file and add any missing values manually"
    
    # Show missing values
    local missing_values=$(grep '\${' "$output_file" | sed 's/.*\(\${[^}]*}\).*/\1/' | sort -u)
    if [[ -n "$missing_values" ]]; then
        print_warning "The following values still need to be populated manually:"
        echo "$missing_values"
        echo ""
        print_warning "To complete setup:"
        echo "1. Sign up for Pusher account at pusher.com"
        echo "2. Sign up for Mapbox account at mapbox.com"
        echo "3. Generate random secrets for JWT_SECRET and SESSION_SECRET"
        echo "4. Edit $output_file and replace the placeholder values"
    fi
}

# Function to validate environment file
validate_env_file() {
    local env_file=$1
    
    if [[ ! -f "$env_file" ]]; then
        print_error "Environment file not found: $env_file"
        return 1
    fi
    
    print_status "Validating environment file: $env_file"
    
    # Check for missing values
    local missing_count=$(grep -c '\${' "$env_file" 2>/dev/null || echo "0")
    if [[ "$missing_count" -gt 0 ]]; then
        print_error "Found $missing_count missing values in $env_file"
        grep '\${' "$env_file" | head -5
        return 1
    fi
    
    print_status "Environment file validation passed"
    return 0
}

# Main function
main() {
    local command=${1:-"help"}
    local stage=${2:-"staging"}
    
    case "$command" in
        "setup")
            print_status "Setting up environment for stage: $stage"
            check_aws_cli
            create_env_file "$stage"
            ;;
        "validate")
            local env_file="$PROJECT_ROOT/.env.$stage.populated"
            validate_env_file "$env_file"
            ;;
        "help"|*)
            echo "Mile Quest Environment Setup Script"
            echo ""
            echo "Usage:"
            echo "  $0 setup [stage]     - Create populated environment file from CloudFormation outputs"
            echo "  $0 validate [stage]  - Validate environment file for missing values"
            echo "  $0 help             - Show this help message"
            echo ""
            echo "Stages: staging, production"
            echo ""
            echo "Examples:"
            echo "  $0 setup staging"
            echo "  $0 setup production"
            echo "  $0 validate staging"
            ;;
    esac
}

# Run main function with all arguments
main "$@"