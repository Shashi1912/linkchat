# LinkChat

A free, real-time group chat website. Share one link, and anyone who opens it types a name and joins the same room. Nobody needs an account.

- **Website hosting:** GitHub Pages (free)
- **Database, realtime and sign-in:** Supabase (free tier)
- **Nothing to install or build.** It's plain HTML, CSS and JavaScript. You don't need Node.js or npm.

```
Chat/
├── index.html                  the page
├── style.css                   look & feel (light + dark)
├── app.js                      chat logic
├── config.js                   ← your Supabase URL + public key go here
├── .nojekyll                   tells GitHub Pages to serve files as-is
└── supabase/001_create_chat.sql  database setup (run once in Supabase)
```

---

## Part A — What you need

- A browser.
- A free **GitHub** account: <https://github.com>
- A free **Supabase** account: <https://supabase.com>
- **Git** (optional). You can also upload the files on the GitHub website.

You don't need Node.js, VS Code or a local server.

---

## Part B — Supabase setup (about 5 minutes)

1. **Create a project.** Go to <https://supabase.com/dashboard>, click **New project**, pick a name such as `linkchat`, set a database password (you won't need it again) and choose the region closest to you. Wait about a minute for it to start.
2. **Turn on anonymous sign-in.** Go to **Authentication → Sign In / Providers** (on older dashboards: Authentication → Providers). Find **Allow anonymous sign-ins** and turn it **on**, then click **Save**.
3. **Create the database.** Go to **SQL Editor → New query**, paste the whole contents of `supabase/001_create_chat.sql` and click **Run**. You should see "Success. No rows returned".
4. **Copy your keys.** Go to **Project Settings → API Keys** (or the **Connect** button at the top) and copy:
   - the **Project URL**, which looks like `https://abcdxyz.supabase.co`
   - the **publishable key** (`sb_publishable_…`), or on older projects the **anon public** key (`eyJ…`)

   ⚠️ Never use the **secret** or **service_role** key. That key bypasses all security.
5. **Put them into `config.js`:**
   ```js
   SUPABASE_URL: 'https://abcdxyz.supabase.co',
   SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxxxxxxx',
   ```
   These two values are meant to be public. Anyone can see them in the browser, and the database rules in the SQL file keep the data safe.

**Checking it worked**
- **Table Editor → messages** should show the table, with a "RLS enabled" badge.
- **Authentication → Policies** should show two policies on `messages`: read, and insert own.
- **Database → Publications → supabase_realtime** should list `messages`.
- **Storage** should show a bucket called `chat-images` marked **Public**. This is where photos go, and the same SQL file created it.

**Try it before publishing:** double-click `index.html` to open it in your browser. You should be able to join and send messages. Open it in a second browser (or a private window) to chat with yourself.

---

## Part C — Publish on GitHub Pages

### Option 1: with Git

Run these in the `Chat` folder:

```powershell
git init -b main
git add .
git commit -m "LinkChat"
```

Create an **empty public** repository named `linkchat` on GitHub (don't add a README), then run:

```powershell
git remote add origin https://github.com/Shashi1912/linkchat.git
git push -u origin main
```

### Option 2: without Git

Create a public repository named `linkchat`. Click **Add file → Upload files**, drag in every file and folder from `Chat`, and click **Commit changes**.

> If `.nojekyll` doesn't upload because it's a hidden file, click **Add file → Create new file**, name it `.nojekyll`, leave it empty and commit.

### Turn on Pages

1. In the repository, go to **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Set the branch to `main` and the folder to `/ (root)`, then click **Save**.
4. Wait 1–2 minutes and refresh. The page shows your site address:
   `https://Shashi1912.github.io/linkchat/`

### Share it

Open the site, join, and click the 🔗 button in the top bar to copy the link. Send that link to your friends on WhatsApp, by email, or anywhere else.

To change something later, edit the file (on GitHub you can click the ✏️ pencil) and commit. The site updates within a minute or two.

---

## How it works (in short)

- **Joining:** Supabase creates an *anonymous user* behind the scenes. Your display name is stored only in your browser. Next time you open the site you go straight back into the chat. **Leave** forgets your name.
- **Messages:** saved in the `messages` table. On joining, the newest 50 load, and **Load earlier messages** fetches 50 more each time.
- **Real time:** new messages arrive instantly through Supabase Realtime. After a network drop, the chat fetches anything it missed.
- **Photos:** tap 📎 and pick a photo. Your browser shrinks it to at most 1600 px (usually 200–400 KB) and uploads it to Supabase Storage. Tap a photo in the chat to open it full size. Photos stay until you delete them yourself in **Storage → chat-images**.
- **Online count:** uses Supabase Presence, which counts open browser tabs (one per person). It disappears while disconnected instead of showing a wrong number. Click it to see who's online.
- **Security (enforced by the database, not the browser):**
  - Only signed-in (anonymous) users can read or send.
  - The server sets who sent each message and when, so nobody can pretend to be someone else's user ID.
  - Nobody can edit or delete messages.
  - Names must be 2–30 characters and messages 1–1000 characters.
  - Spam limit: at most 5 messages per 10 seconds per user.
  - Messages are always shown as plain text, so HTML or scripts typed into a message never run.
  - Photos: images only, at most 5 MB each, and each person can upload only into their own folder. Nobody can replace or delete someone else's photo.

### Limits to know about

- **This room is public.** Anyone with the link can read the whole history. Don't use it for confidential information.
- A display name is just a nickname, so two people can pick the same one.
- **Photos are public too.** Anyone who has a photo's link can open it.
- **Supabase free tier:** about 500 MB of database storage, **1 GB of photo storage** (roughly 3,000 photos), and 200 simultaneous realtime connections. A project **pauses after a week with no activity**. You can restore it from the dashboard with one click.
- Supabase limits how many new anonymous users one IP address can create per hour (default 30). Normal use won't hit this.
- If someone clears their browser data, they come back as a new anonymous user, and their old messages show on the left side like everyone else's.

---

## Part D — Troubleshooting

| Problem | Fix |
|---|---|
| Page says "Almost there!" | `config.js` still has the `YOUR_…` placeholders. Fill them in and commit. |
| "Anonymous sign-in is turned off" | Do Part B step 2. |
| "Photo storage is missing" | The `chat-images` bucket wasn't created. Re-run the SQL file. |
| "Did you run the SQL setup?" or permission errors | Run `supabase/001_create_chat.sql` again in the SQL Editor (running it twice is safe). |
| Messages only appear after refresh | Realtime isn't on for the table. Check **Database → Publications → supabase_realtime** includes `messages`, or re-run the SQL. |
| "Reconnecting…" stays visible | Check your internet. If the Supabase project is **paused**, restore it in the dashboard. |
| Blank page or 404 on GitHub Pages | Wait 2 minutes after enabling Pages. Make sure `index.html` is at the **top level** of the repository, not inside a `Chat/` folder. |
| Styles missing (plain-looking page) | Same cause: `style.css`, `app.js` and `config.js` must sit next to `index.html`. |
| "You are sending messages too fast" | The spam limit worked. Wait a few seconds and press **Retry**. |
| Nothing works and the browser console mentions `supabase` | The Supabase library loads from `cdn.jsdelivr.net`. A strict network or firewall may block it. |

---

## Changing things

- **Room name:** `ROOM_NAME` in `config.js`.
- **Separate room:** use another copy of the site with a different `ROOM_ID` in `config.js`, such as `team-a`. Lowercase letters, numbers, `-` and `_` only.
- **Colours:** the variables at the top of `style.css`.

---

## 🚀 Live Release & Next-Gen Architecture (v3.0.3)

LinkChat is currently running **v3.0.3** on GitHub Pages (`https://shashi1912.github.io/linkchat/`).

### Currently Deployed & Active Features:
1. **WebRTC Calling Suite**: Peer-to-peer crystal-clear voice and HD video calling with floating Picture-in-Picture (PIP), synthesized Apple dial tones, and 1-tap live screen sharing.
2. **Apple Voice Notes (Walkie-Talkie)**: Live visualizer audio recording, waveform speech bubbles, and **1× / 1.5× / 2× speed switching**.
3. **iMessage-Style Social Interactions**: Floating Apple emoji reaction pills (`❤️`, `👍`, `😂`, `🔥`, `👏`) with live participant counters, quoted replies (`↩️`), and smart client-side photo downscaling.
4. **Fortified Security & Privacy Shield**:
   - **Tab-Shift Auto-Lock**: Screen locks immediately on tab shift / window blur; unlocking strictly requires the room password.
   - **Zero-Disk Ephemeral Keys**: Room keys are memory-only—never saved in localStorage or URL history.
   - **Brute-Force Rate Limiting**: Progressive lockouts (15s, 30s, 60s) via `RoomSecurity`.
   - **Zero-Knowledge E2EE**: AES-256-GCM client-side encryption for private rooms.
5. **1-Scan QR Pairing**: Built-in modal generating instant scannable QR codes for 1-tap phone camera joining.
6. **Progressive Web App (PWA)**: Full offline service worker caching and installability on iOS and Android.

---

## 🔮 Future Architecture & Development Roadmap (Next Conversation Handoff)

*Use this section as the primary context to resume development in the next session.*

### 1. 🌐 Serverless Offline Mesh Network (Zero-Internet Communication)
* **Goal**: Enable direct phone-to-phone and PC-to-PC encrypted messaging with **zero internet, zero cellular data, and zero cloud servers**.
* **Core Technical Pillars**:
  1. **Local Hotspot / Subnet Routing**: Direct WebRTC DataChannels over local Wi-Fi radios or phone personal hotspots (even with mobile data turned off).
  2. **Optical QR Handshake (AirDrop Style)**: Device A presents an SDP offer QR code; Device B scans it with its camera to complete the connection handshake without touching any external server.
  3. **Multi-Hop Relay Protocol**: Devices act as mesh repeater nodes—messages seamlessly hop through intermediary devices to reach distant participants.
  4. **Full PWA Offline Boot**: Service Worker caches all assets locally so LinkChat boots in 0.2s in 100% Airplane Mode.

### 2. 🎮 In-Chat Real-Time Multiplayer Gaming Arena
* **Goal**: Zero-download, 60FPS multiplayer games embedded directly inside chat bubbles and offline mesh streams.
* **Target Games**:
  - **Cyberpunk Neon Air Hockey**: 60FPS high-speed P2P physics duel using mouse/touch paddles over WebRTC DataChannels.
  - **Apple Glass Chess**: Tactical turn-based multiplayer with room spectator mode and emoji cheering.
  - **Multiplayer Snake Royale**: Multi-user arena battle with real-time room leaderboard.
  - **Real-Time Pictionary / Scribble Duel**: Synchronized interactive whiteboard guessing game.

### 3. 🧠 Multi-Agent Personal AI Swarm
* **Goal**: Co-presence personal AI agents embedded in group rooms that research, run simulations, summarize missed history, and generate consensus matrices for group decisions.

### 4. 🌌 Generative 3D Spatial Canvas
* **Goal**: 1-click transformation of 2D chat into an interactive 3D spatial audio environment where avatars move and interact in shared space.

### 5. 📡 Long-Range Off-Grid Relay Principles (1,000+ km)
* **Documented Protocols**: Skywave Ionospheric HF radio bouncing, Direct-to-Cell LEO satellite relays, and Delay-Tolerant "Data Mule" routing.

---

### 📍 Where to Start the Next Conversation:
To continue, simply reference this section and instruct the agent:
> *"Let's implement the Serverless Offline Mesh Network and the In-Chat Multiplayer Arena from the README roadmap."*
