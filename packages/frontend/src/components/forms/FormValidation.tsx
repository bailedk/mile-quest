'use client';

import React, { useState, useCallback, useMemo } from 'react';

// Validation rule types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export interface FieldValidation {
  [fieldName: string]: ValidationRule[];
}

// Field error state
interface FieldError {
  message: string;
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
}

// Enhanced Input Component with validation
interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  name: string;
  label: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: FieldError;
  helperText?: string;
  showValidation?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  rules?: ValidationRule[];
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export function ValidatedInput({
  name,
  label,
  value,
  onChange,
  error,
  helperText,
  showValidation = true,
  validateOnBlur = true,
  validateOnChange = false,
  rules = [],
  icon,
  endAdornment,
  className = '',
  ...inputProps
}: ValidatedInputProps) {
  const [isTouched, setIsTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const hasError = error && showValidation && (isTouched || validateOnChange);
  const showSuccess = showValidation && isTouched && !error && value.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(name, newValue);
  };

  const handleBlur = () => {
    setIsTouched(true);
    setIsFocused(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const inputClasses = `
    block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    transition-all duration-200
    ${hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
    ${showSuccess ? 'border-green-500 focus:ring-green-500 focus:border-green-500' : ''}
    ${!hasError && !showSuccess ? 'border-gray-300' : ''}
    ${icon ? 'pl-10' : ''}
    ${endAdornment ? 'pr-10' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {rules.some(rule => rule.required) && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </label>
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">
              {icon}
            </span>
          </div>
        )}
        
        <input
          {...inputProps}
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${name}-error` : 
            helperText ? `${name}-helper` : undefined
          }
        />
        
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {endAdornment}
          </div>
        )}
        
        {/* Validation indicators */}
        {showValidation && isTouched && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {hasError ? (
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : showSuccess ? (
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : null}
          </div>
        )}
      </div>

      {/* Helper text and error messages */}
      {hasError && (
        <p id={`${name}-error`} className="text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error.message}
        </p>
      )}
      
      {!hasError && helperText && (
        <p id={`${name}-helper`} className="text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
}

// Form validation hook
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: FieldValidation
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validate single field
  const validateField = useCallback((name: string, value: any): FieldError | null => {
    const rules = validationRules[name] || [];
    
    for (const rule of rules) {
      // Required validation
      if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return {
          message: rule.message || `${name} is required`,
          type: 'required'
        };
      }
      
      // Skip other validations if value is empty and not required
      if (!value) continue;
      
      // Minimum length validation
      if (rule.minLength && value.length < rule.minLength) {
        return {
          message: rule.message || `${name} must be at least ${rule.minLength} characters`,
          type: 'minLength'
        };
      }
      
      // Maximum length validation
      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          message: rule.message || `${name} must be no more than ${rule.maxLength} characters`,
          type: 'maxLength'
        };
      }
      
      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        return {
          message: rule.message || `${name} format is invalid`,
          type: 'pattern'
        };
      }
      
      // Custom validation
      if (rule.custom) {
        const customError = rule.custom(value);
        if (customError) {
          return {
            message: customError,
            type: 'custom'
          };
        }
      }
    }
    
    return null;
  }, [validationRules]);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, FieldError> = {};
    let isValid = true;
    
    Object.keys(values).forEach(name => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  }, [values, validateField]);

  // Set field value and validate
  const setValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
        return newErrors;
      });
    }
  }, [touched, validateField]);

  // Mark field as touched
  const setFieldTouched = useCallback((name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate on touch
    const error = validateField(name, values[name]);
    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      return newErrors;
    });
  }, [values, validateField]);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  // Get field props for easy integration
  const getFieldProps = useCallback((name: string) => ({
    name,
    value: values[name] || '',
    onChange: setValue,
    error: errors[name],
    onBlur: () => setFieldTouched(name)
  }), [values, errors, setValue, setFieldTouched]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    values,
    errors,
    touched,
    isValid,
    hasErrors,
    setValue,
    setTouched: setFieldTouched,
    validateField,
    validateAll,
    reset,
    getFieldProps
  };
}

// Common validation rules
export const validationRules = {
  email: [
    { required: true, message: 'Email is required' },
    { 
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
      message: 'Please enter a valid email address' 
    }
  ],
  password: [
    { required: true, message: 'Password is required' },
    { minLength: 8, message: 'Password must be at least 8 characters' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  ],
  confirmPassword: (password: string) => [
    { required: true, message: 'Please confirm your password' },
    {
      custom: (value: string) => 
        value !== password ? 'Passwords do not match' : null
    }
  ],
  name: [
    { required: true, message: 'Name is required' },
    { minLength: 2, message: 'Name must be at least 2 characters' },
    { maxLength: 50, message: 'Name must be less than 50 characters' }
  ],
  teamName: [
    { required: true, message: 'Team name is required' },
    { minLength: 3, message: 'Team name must be at least 3 characters' },
    { maxLength: 30, message: 'Team name must be less than 30 characters' }
  ]
};