# 🌟 Noor — Mental Health Screening Platform
## Deployment Guide (Go Live on the Internet)

---

## 📁 Folder Structure for Deployment

Only the `backend/` folder needs to be deployed — it contains everything:

```
backend/
├── server.js          ← Express server (serves API + frontend)
├── db.js              ← SQLite database
├── package.json
├── Procfile           ← For Railway/Heroku
├── .env.example       ← Copy to .env for local dev
├── .gitignore
└── frontend/
    └── index.html     ← Full frontend UI
```

---

## 🚀 Option 1: Railway (RECOMMENDED — Free, Easiest, 10 min)

Railway gives you a live URL like `https://noor-production.up.railway.app`

### Steps:

**1. Create a GitHub account** (if you don't have one)
→ https://github.com/signup

**2. Create a new GitHub repository**
- Go to https://github.com/new
- Name it `noor-app`, set to Private, click Create

**3. Upload your backend/ folder to GitHub**

Open Command Prompt in your `backend/` folder and run:
```bash
git init
git add .
git commit -m "Initial Noor deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/noor-app.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username.

**4. Deploy on Railway**
- Go to https://railway.app
- Click **"Start a New Project"**
- Choose **"Deploy from GitHub repo"**
- Select your `noor-app` repository
- Railway will auto-detect Node.js and deploy it

**5. Set Environment Variables on Railway**
In your Railway project dashboard → Variables tab → Add:
```
PORT          = 3000
ADMIN_PIN     = your_chosen_pin
JWT_SECRET    = any_long_random_string_here_min_32_chars
JWT_EXPIRES_IN= 8h
```

**6. Get your live URL**
Railway gives you a URL like:
`https://noor-app-production.up.railway.app`

Share this link — anyone in the world can now fill the form!

---

## 🚀 Option 2: Render (Also Free)

**1.** Go to https://render.com → Sign up
**2.** New → Web Service → Connect your GitHub repo
**3.** Set:
- Build Command: `npm install`
- Start Command: `node server.js`
- Root Directory: *(leave blank)*
**4.** Add Environment Variables (same as Railway above)
**5.** Click Deploy → Get your `.onrender.com` URL

---

## 🚀 Option 3: Heroku

**1.** Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
**2.** In `backend/` folder:
```bash
heroku login
heroku create noor-health-app
git push heroku main
heroku config:set ADMIN_PIN=2104 JWT_SECRET=your_secret
heroku open
```

---

## ⚠️ Important: Database on Cloud

**sql.js saves to a file (`noor.db`) on the server disk.**
On Railway/Render free tier, the disk resets if the server restarts.

### To keep data permanently, use one of these:

**Option A — Download backup regularly**
- Visit `https://your-url/api/admin/export` (with auth)
- Download records as JSON/Excel before they reset

**Option B — Upgrade to Railway Paid ($5/month)**
- Enables persistent disk storage
- Data never lost on restart

**Option C — Switch to PostgreSQL (Free, Permanent)**
Tell me and I'll update the code to use Railway's free PostgreSQL — data is stored in a real cloud database and never lost.

---

## 🔒 Security Checklist Before Going Live

- [ ] Change `ADMIN_PIN` from `2104` to something strong
- [ ] Set `JWT_SECRET` to a long random string (30+ chars)
- [ ] Keep your GitHub repo **Private**
- [ ] Never commit your `.env` file (it's in `.gitignore`)

---

## 📱 Sharing Your Link

Once deployed, your link works on:
- Any browser (Chrome, Firefox, Safari)
- Mobile phones
- Any network (college, home, hospital)

Just share: `https://your-app-name.up.railway.app`
