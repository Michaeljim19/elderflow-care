import emailjs from '@emailjs/browser'

/*
 * EmailJS Configuration Setup Instructions:
 * 
 * 1. Create an EmailJS account at https://www.emailjs.com/
 * 2. Create a new service (e.g., Gmail, Outlook, etc.)
 * 3. Create email templates with the following IDs:
 *    - template_account_creation (for account creation emails)
 *    - template_password_reset (for password reset emails)  
 *    - template_account_status (for account status changes)
 * 4. Get your Public Key from EmailJS dashboard
 * 5. Update the constants below with your actual values
 * 
 * Required template variables for template_account_creation:
 * - name: Contact person name
 * - time: Current timestamp
 * - message: Welcome message/admin notes
 * - company_name: Company name
 * - caregiver_name: Name of the person receiving the account
 * - login_url: URL to login page
 * - username: Generated login email
 * - temporary_password: Generated password
 * - support_email: Support contact email
 * - sender_name: Name of the sender
 * - sender_email: Email of the sender
 * - company_website: Company website
 * - to_email: Recipient email address
 * - to_name: Recipient name
 */

// EmailJS Configuration - UPDATE THESE VALUES
const EMAILJS_SERVICE_ID = 'service_70i1m0d' // Your actual service ID
const EMAILJS_TEMPLATE_ID = 'template_2ih1pol' // Your actual template ID - MAKE SURE THIS TEMPLATE HAS {{to_email}} AS RECIPIENT
const EMAILJS_PUBLIC_KEY = 'NU8mlKxa48FyuSWw-' // Your provided API key

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY)

// Configuration validation function
export const validateEmailJSConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID.length < 10) {
    errors.push('Service ID is not configured or appears invalid')
  }
  
  if (!EMAILJS_TEMPLATE_ID || EMAILJS_TEMPLATE_ID.length < 10) {
    errors.push('Template ID is not configured or appears invalid')
  }
  
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.length < 10) {
    errors.push('Public Key appears to be invalid or too short')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

interface AccountCreationEmailData {
  to_email: string
  to_name: string
  account_type: 'caregiver' | 'patient'
  temporary_password: string
  login_url: string
  verification_url?: string
  admin_notes?: string
  username?: string  // Add username field for the generated login email
  confirmation_url?: string // Add confirmation URL for the button
  // verification_code?: string // Add code for code-based verification
}

export const sendAccountCreationEmail = async (data: AccountCreationEmailData): Promise<void> => {
  try {
    // Validate configuration first (temporarily disabled for testing)
    const configValidation = validateEmailJSConfig()
    if (!configValidation.isValid) {
      console.warn('EmailJS Configuration Issues:')
      configValidation.errors.forEach(error => console.warn('- ' + error))
      console.warn('Proceeding with email send despite configuration warnings...')
    }

    // Template parameters for EmailJS (matching your template variables)
    const templateParams = {
      // Original message parameters (for the top part of the template)
      name: data.to_name,
      time: new Date().toLocaleString(),
      message: data.admin_notes || 'Your caregiver account has been created successfully!',
      
      // Company and account details
      company_name: 'ElderFlow Care',
      caregiver_name: data.to_name,
      login_url: data.login_url,
      username: data.username || data.to_email, // Use provided username or fall back to email
      temporary_password: data.temporary_password,
      
      // Confirmation/Verification URLs and button
      verification_url: data.verification_url || data.login_url,
      confirmation_url: data.confirmation_url || data.verification_url || data.login_url,
      confirm_button_text: 'Confirm Account & Login',
      confirm_button_color: '#3B82F6', // Blue color
      
      // Support and contact information
      support_email: 'support@elderflowcare.com',
      sender_name: 'Admin Team',
      sender_email: 'admin@elderflowcare.com',
      company_website: 'www.elderflowcare.com',
      
      // EmailJS destination (where the email is sent TO)
      to_email: data.to_email,
      to_name: data.to_name,
      
      // Additional EmailJS parameters to override template settings
      email_to: data.to_email, // Alternative parameter name
      reply_to: data.to_email,  // Another way to set recipient
    }

    console.log('Sending account creation email with EmailJS...')
    console.log('Service ID:', EMAILJS_SERVICE_ID)
    console.log('Template ID:', EMAILJS_TEMPLATE_ID)
    console.log('Public Key:', EMAILJS_PUBLIC_KEY)
    console.log('Template params:', templateParams)
    console.log('Sending TO EMAIL:', data.to_email)
    
    // Try using EmailJS with direct parameters to override template recipient
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        ...templateParams,
        // Try multiple parameter names that EmailJS might recognize for recipient
        user_email: data.to_email,
        recipient: data.to_email,
        destination: data.to_email,
      },
      EMAILJS_PUBLIC_KEY
    )
    
    if (response.status === 200) {
      console.log('Account creation email sent successfully via EmailJS')
    } else {
      throw new Error(`EmailJS failed with status: ${response.status}`)
    }

  } catch (error) {
    console.error('Error sending account creation email via EmailJS:', error)
    
    // Log more specific error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error details:', error)
    }
    
    // Check if it's an EmailJS specific error
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const emailjsError = error as any
      console.error('EmailJS Error Status:', emailjsError.status)
      console.error('EmailJS Error Text:', emailjsError.text)
      
      if (emailjsError.status === 400 && emailjsError.text && emailjsError.text.includes('template ID not found')) {
        console.error('TEMPLATE ID ERROR: The template ID "' + EMAILJS_TEMPLATE_ID + '" does not exist in your EmailJS dashboard.')
        console.error('Please visit https://dashboard.emailjs.com/admin/templates to find the correct template ID.')
        throw new Error('Template not found: "' + EMAILJS_TEMPLATE_ID + '". Please check your EmailJS dashboard for the correct template ID.')
      }
    }
    
    // Fallback: Log account details to console for manual processing
    console.log('Account creation details (for manual processing):')
    console.log({
      email: data.to_email,
      name: data.to_name,
      role: data.account_type,
      temporaryPassword: data.temporary_password,
      loginUrl: data.login_url
    })
    
    // Provide more specific error message based on common issues
    let errorMessage = 'Failed to send account creation email. '
    
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = (error as any).status
      switch (status) {
        case 400:
          errorMessage += 'Bad request - please check EmailJS service configuration (Service ID, Template ID, or parameters).'
          break
        case 401:
          errorMessage += 'Unauthorized - please check your EmailJS public key.'
          break
        case 404:
          errorMessage += 'Service or template not found - please verify your EmailJS Service ID and Template ID.'
          break
        default:
          errorMessage += `Server responded with status ${status}.`
      }
    } else {
      errorMessage += 'Please check your EmailJS configuration and try again.'
    }
    
    errorMessage += ' Account details have been logged to console for manual processing.'
    
    // Throw a user-friendly error message
    throw new Error(errorMessage)
  }
}

// Email template for password reset
interface PasswordResetEmailData {
  to_email: string
  to_name: string
  reset_link: string
  expiration_time: string
}

export const sendPasswordResetEmail = async (data: PasswordResetEmailData): Promise<void> => {
  try {
    const templateParams = {
      to_email: data.to_email,
      to_name: data.to_name,
      reset_link: data.reset_link,
      expiration_time: data.expiration_time,
      system_name: 'ElderFlow Care Management',
      support_email: 'support@elderflowcare.com'
    }

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      'template_password_reset',
      templateParams,
      EMAILJS_PUBLIC_KEY
    )

    if (response.status !== 200) {
      throw new Error(`EmailJS failed with status: ${response.status}`)
    }

    console.log('Password reset email sent successfully')

  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Failed to send password reset email')
  }
}

// Email template for account status change
interface AccountStatusEmailData {
  to_email: string
  to_name: string
  status_change: 'activated' | 'suspended' | 'reactivated'
  reason?: string
}

export const sendAccountStatusEmail = async (data: AccountStatusEmailData): Promise<void> => {
  try {
    const templateParams = {
      to_email: data.to_email,
      to_name: data.to_name,
      status_change: data.status_change,
      reason: data.reason || '',
      system_name: 'ElderFlow Care Management',
      support_email: 'support@elderflowcare.com',
      change_date: new Date().toLocaleDateString()
    }

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      'template_account_status',
      templateParams,
      EMAILJS_PUBLIC_KEY
    )

    if (response.status !== 200) {
      throw new Error(`EmailJS failed with status: ${response.status}`)
    }

    console.log('Account status email sent successfully')

  } catch (error) {
    console.error('Error sending account status email:', error)
    throw new Error('Failed to send account status email')
  }
}

// Export types for use in other components
export type { AccountCreationEmailData, PasswordResetEmailData, AccountStatusEmailData }
