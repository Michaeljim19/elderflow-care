# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f85e9aba-82ee-4cae-9249-4bf86dba3f9b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f85e9aba-82ee-4cae-9249-4bf86dba3f9b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Firebase (Authentication & Database)
- EmailJS (Email notifications)

## EmailJS Setup

The application uses EmailJS for sending account creation emails. To enable email functionality:

1. **Create EmailJS Account**: Visit [EmailJS.com](https://www.emailjs.com/) and create an account
2. **Create Email Service**: Set up an email service (Gmail, Outlook, etc.) with service ID: `service_elderflow`
3. **Create Email Templates**: 
   - Create template with ID: `template_account_creation` for account creation emails
   - Create template with ID: `template_password_reset` for password reset emails
   - Create template with ID: `template_account_status` for account status updates

### Account Creation Email Template Variables:
```
{{to_email}} - Recipient email
{{to_name}} - Recipient name
{{account_type}} - Account type (Caregiver/Patient Guardian)
{{temporary_password}} - Generated password
{{login_url}} - Application login URL
{{admin_notes}} - Admin notes/welcome message
{{system_name}} - System name
{{support_email}} - Support email
{{created_date}} - Account creation date
```

4. **Update Configuration**: The EmailJS public key is already configured. Update service and template IDs in `src/services/emailjs.ts` if needed.

**Note**: The application includes fallback error handling that logs account details to console if email sending fails.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f85e9aba-82ee-4cae-9249-4bf86dba3f9b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
