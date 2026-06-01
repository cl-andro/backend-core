# Git Social - Setup Guide

This guide explains how to set up the modified Git City repository as a social media platform where users sign in with GitHub and get assigned a repository in an organization for their posts.

## Project Overview

Git Social transforms Git City into a social media platform by:

1. **GitHub Organization Integration**: Users sign in with GitHub OAuth and get assigned a personal repository (`social-{username}`) in a specified GitHub organization
2. **Social Media Skin**: Updated UI with Facebook-inspired design elements
3. **Developer-Centric Social Features**: Users post to their assigned GitHub repositories, creating a developer-focused social network

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- GitHub account (for personal access token)
- Supabase account (for database and authentication)
- GitHub Organization (where user repositories will be created)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/srizzon/git-city.git
cd git-city

# Install dependencies
npm install
```

> **Note**: If you encounter installation issues, try:
> ```bash
> npm cache clean --force
> npm install --legacy-peer-deps
> ```

### 2. Environment Configuration

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with the following variables:

#### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### GitHub Configuration
```
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_ORGANIZATION=your_github_organization_name
```

#### Optional Admin Configuration
```
ADMIN_GITHUB_LOGINs=comma_separated_list_of_github_usernames_with_admin_access
```

### 3. GitHub Token Setup

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with these scopes:
   - `repo` (full control of private repositories)
   - `read:org` (read organization and team membership)
   - `admin:org_hook` (manage organization webhooks)
   - `read:user` (read user profile data)
   - `user:email` (read user email addresses)
   - `delete_repo` (delete repositories)
3. Copy the generated token and paste it into `GITHUB_TOKEN` in `.env.local`

### 4. GitHub Organization Setup

1. Create a GitHub Organization if you don't have one already
2. Ensure the personal access token has permission to create repositories in this organization
3. Set the organization name in `GITHUB_ORGANIZATION` variable

### 5. Database Setup

Run the Supabase migration to add the necessary columns for tracking user repositories:

```bash
npx supabase db push
```

This will apply the migration in `supabase/migrations/0092_add_user_repo.sql` which adds:
- `assigned_repo` (text) to the `developers` table
- `assigned_repo_url` (text) to the `developers` table
- Creates a new `user_repos` table for extended tracking

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the application.

## How It Works

### User Flow

1. User visits the site and clicks "Sign in with GitHub"
2. User authenticates with GitHub and grants requested permissions
3. Upon successful authentication:
   - System checks if user already has an assigned repository
   - If not, creates a new repository named `social-{username}` in the specified GitHub organization
   - Updates the user's record in Supabase with the assigned repository details
4. User is redirected to their profile page showing their assigned social repository
5. In the future, posts made by the user will be saved as issues in their assigned repository

### Repository Naming Convention

Each user gets a repository named: `social-{github_username}`

For example, a user with GitHub username `alice` would get repository: `social-alice`

## Customization

### Changing the Social Media Theme

The application uses a Facebook-inspired color scheme. To modify:

1. **Colors**: Edit `src/app/globals.css` to change the color variables
2. **Themes**: Modify theme definitions in `src/components/CityCanvas.tsx` 
3. **Fonts**: Update font imports in `src/app/layout.tsx` or `src/app/globals.css`

### Modifying Repository Creation Logic

The repository creation happens in:
- `src/lib/github-api.ts`: `createUserRepository()` function
- `src/app/auth/callback/route.ts`: Where the function is called during OAuth callback

## Important Notes

### Permissions

The GitHub token needs sufficient permissions to:
- Create repositories in the specified organization
- Read user information
- Manage repository webhooks (for future features)

### Data Storage

- User profiles and assigned repository information are stored in Supabase
- Actual posts/content will be stored as GitHub issues in users' assigned repositories
- The original Git City functionality (viewing any GitHub profile as a building) is preserved

### Troubleshooting

#### Installation Issues
If you encounter npm installation problems:
1. Try clearing npm cache: `npm cache clean --force`
2. Try using legacy peer deps: `npm install --legacy-peer-deps`
3. Consider using yarn or pnpm as alternative package managers

#### OAuth Issues
If GitHub authentication fails:
1. Verify your GitHub token has the correct scopes
2. Check that `GITHUB_ORGANIZATION` matches your organization name exactly
3. Ensure the token has permission to create repositories in the organization

#### Database Issues
If migrations fail to apply:
1. Verify your Supabase credentials in `.env.local`
2. Check that the Supabase service role key has sufficient permissions
3. Try running migrations manually through the Supabase dashboard

## License

This project is modified from Git City, which is licensed under AGPL-3.0. See the [LICENSE](LICENSE) file for details.

---

*Built as a modification of Git City by Samuel Rizzon*