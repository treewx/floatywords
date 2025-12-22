# Deployment Instructions for DreamHost

This project is a static React application built with Vite. It does not require a Node.js server to run; it only needs a web server to serve static files (HTML, CSS, JS), which DreamHost handles perfectly.

## 1. Build the Project
We have already run this for you, but for future reference:
```bash
npm run build
```
This creates a `dist` folder in your project directory containing the production-ready files.

## 2. Upload to DreamHost
You need to upload the **contents** of the `dist` folder to your website's public directory on DreamHost.

### Using SFTP (Recommended)
1.  Connect to your DreamHost account using an FTP client like **FileZilla**.
    *   **Host**: `ftp.dreamhost.com` (or your specific cluster)
    *   **Username/Password**: Your FTP credentials.
2.  Navigate to your domain's folder on the server (usually `/home/your_username/your_domain.com`).
3.  Delete any existing `index.html` or default files if this is a fresh site.
4.  Upload **all files and folders inside** the local `dist` folder (e.g., `index.html`, `assets/`, `vite.svg`) to the server folder.
    *   *Do not upload the `dist` folder itself, just its contents.*

### Using DreamHost WebFTP
1.  Log in to the DreamHost Panel.
2.  Go to **Websites** > **Manage Websites**.
3.  Click **Manage Files** (or WebFTP) for your domain.
4.  Upload the contents of the `dist` folder.

## 3. Subdirectory Deployment (Optional)
If you want to host this at `yourdomain.com/floatywords` instead of the root `yourdomain.com`:
1.  Open `vite.config.js`.
2.  Add `base: '/floatywords/',` to the configuration.
3.  Run `npm run build` again.
4.  Create a folder named `floatywords` on your server and upload the `dist` contents there.
