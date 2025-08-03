# HomeStream - Home Network Video Library

A simple Node.js web application that allows streaming videos from a computer on a local network.

## Deployment Guide

This guide describes how to deploy and run the HomeStream Node.js application on a local Ubuntu server, making it accessible over home network via port 80.

---

### 📁 Project Directory

Project is located at:  
`/www/homestream`

The main entry point is:  
`dist/server.js`

---

### ✅ Prerequisites

Ensure the following are installed:

- Node.js (v20+ recommended)
- `systemd` (default on Ubuntu)
- `ufw` (optional, for firewall control)

---

### ⚙️ Step 1: Grant Node.js Permission for Port 80

To allow Node.js to bind to privileged port 80 without running as root:

```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

---

### 🧾 Step 2: Create systemd Service

1. Create the systemd service file:

```bash
sudo nano /etc/systemd/system/homestream.service
```

2. Paste the following:

```ini
[Unit]
Description=HomeStream Node.js Service
After=network.target

[Service]
Environment=PORT=80
WorkingDirectory=/www/homestream
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
User=your-username
Group=your-username
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> Replace `your-username` with your actual Ubuntu username.  
> Confirm the Node.js path with `which node`.

---

### 🔁 Step 3: Start and Enable the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable homestream
sudo systemctl start homestream
```

To check status:
```bash
sudo systemctl status homestream
```

To view logs:
```bash
journalctl -u homestream -f
```

---

### 🔓 Step 4: Open Firewall Port (Optional)

If you're using UFW:

```bash
sudo ufw allow 80/tcp
```

---

### 🌐 Step 5: Access the App on the Network

Ensure the app is listening on `0.0.0.0` in the server code:

```js
app.listen(process.env.PORT || 80, '0.0.0.0');
```

Access the app from any device on the same network via:

- **Hostname (if mDNS is enabled):**
  ```
  http://your-hostname.local
  ```

- **Custom Local Domain (if using dnsmasq or similar):**
  ```
  http://mydomain.home
  ```

- **Local IP Address:**
  ```
  http://192.168.x.x
  ```

---

### 🔁 Updating the App

After changing code or rebuilding `dist/server.js`, restart the service:

```bash
sudo systemctl restart homestream
```

---

## ✅ Done

Your Node.js app should now be running on port 80 and accessible across your home network!
