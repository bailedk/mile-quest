# Domain Setup for mile-quest.com

## Route 53 Configuration

### Step 1: Create Hosted Zone
```bash
# Create hosted zone in Route 53
aws route53 create-hosted-zone \
  --name mile-quest.com \
  --caller-reference "$(date +%s)" \
  --hosted-zone-config Comment="Mile Quest team walking challenge platform"
```

### Step 2: Update Domain Registrar
Point your domain registrar's nameservers to Route 53:
- ns-XXX.awsdns-XX.com
- ns-XXX.awsdns-XX.net
- ns-XXX.awsdns-XX.org
- ns-XXX.awsdns-XX.co.uk

### Step 3: SSL Certificate
```bash
# Request ACM certificate for CloudFront (must be in us-east-1)
aws acm request-certificate \
  --domain-name mile-quest.com \
  --subject-alternative-names "*.mile-quest.com" \
  --validation-method DNS \
  --region us-east-1
```

## DNS Records Configuration

### Production Environment
```
# A Record - Main site
mile-quest.com → CloudFront Distribution

# AAAA Record - IPv6
mile-quest.com → CloudFront Distribution (IPv6)

# CNAME Records
www.mile-quest.com → mile-quest.com
api.mile-quest.com → API Gateway Custom Domain
ws.mile-quest.com → WebSocket API Gateway
```

### Development Environments
```
dev.mile-quest.com → Development CloudFront
staging.mile-quest.com → Staging CloudFront
```

### Email Configuration
```
# MX Records (example using AWS WorkMail)
10 inbound-smtp.us-east-1.amazonaws.com

# SPF Record
TXT: "v=spf1 include:amazonses.com ~all"

# DKIM Records
CNAME: [selector]._domainkey → [selector].dkim.amazonses.com
```

## CloudFront Distribution Setup

### Origin Configuration
```yaml
Origins:
  - S3 Static Content:
      Domain: mile-quest-web.s3.amazonaws.com
      Path: /production
      OAI: Enabled
  
  - API Gateway:
      Domain: api.mile-quest.com
      Path: /v1
      Custom Headers:
        - X-API-Key: ${API_KEY}
```

### Behaviors
```yaml
Default (*):
  Origin: S3 Static Content
  Viewer Protocol: Redirect HTTP to HTTPS
  Allowed Methods: GET, HEAD
  Cache Policy: Managed-CachingOptimized
  Compress: Yes

/api/*:
  Origin: API Gateway
  Viewer Protocol: HTTPS Only
  Allowed Methods: ALL
  Cache Policy: Managed-CachingDisabled
  Origin Request Policy: Managed-AllViewer
```

### Security Headers
```yaml
Response Headers Policy:
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
  Referrer-Policy: strict-origin-when-cross-origin
```

## Subdomain Strategy

### Application Subdomains
```
mile-quest.com           → Main web application
app.mile-quest.com       → Progressive Web App
api.mile-quest.com       → REST API
ws.mile-quest.com        → WebSocket endpoint
admin.mile-quest.com     → Admin dashboard
```

### Environment Subdomains
```
dev.mile-quest.com       → Development environment
staging.mile-quest.com   → Staging environment
beta.mile-quest.com      → Beta testing
```

### Service Subdomains
```
status.mile-quest.com    → Status page (StatusPage.io)
docs.mile-quest.com      → API documentation
support.mile-quest.com   → Help center
```

## Multi-Region Strategy

### Primary Region: us-east-1
- All core services
- CloudFront origin
- Primary database

### Failover Region: us-west-2
- Read replica database
- Static content backup
- Disaster recovery

### Route 53 Health Checks
```yaml
Health Check:
  Type: HTTPS
  Resource Path: /health
  Interval: 30 seconds
  Failure Threshold: 3
  
Routing Policy:
  Primary: 100% (when healthy)
  Failover: us-west-2 (when primary fails)
```

## Cost Considerations

### Monthly Costs
- Route 53 Hosted Zone: $0.50
- Route 53 Queries: ~$0.40 (1M queries)
- ACM Certificate: Free
- CloudFront: Usage-based (~$0.085/GB)

### Cost Optimization
1. Use CloudFront caching aggressively
2. Implement Route 53 alias records (free queries)
3. Use AWS Shield Standard (free DDoS protection)
4. Consider CloudFront security savings plan

## Implementation Timeline

### Phase 1: Basic Setup (Day 1)
- [ ] Create Route 53 hosted zone
- [ ] Update nameservers
- [ ] Request ACM certificate
- [ ] Create basic A record

### Phase 2: CloudFront (Day 2-3)
- [ ] Create S3 bucket for static hosting
- [ ] Configure CloudFront distribution
- [ ] Set up custom domain
- [ ] Test HTTPS redirect

### Phase 3: API Setup (Week 1)
- [ ] Create API Gateway custom domain
- [ ] Configure api.mile-quest.com
- [ ] Set up WebSocket endpoint
- [ ] Test API routing

### Phase 4: Advanced Features (Week 2)
- [ ] Configure email (SES)
- [ ] Set up monitoring endpoints
- [ ] Implement health checks
- [ ] Configure failover

## Monitoring & Alerts

### CloudWatch Alarms
- Route 53 health check failures
- CloudFront 4xx/5xx error rates
- Certificate expiration (30 days)
- DNS query anomalies

### Regular Maintenance
- Review DNS query patterns monthly
- Update security headers quarterly
- Test failover procedures
- Monitor SSL certificate renewal