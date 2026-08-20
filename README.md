# 🔱 SS ENTERPRISES — ABHA Real-Time Work Portal

Welcome to the official workspace app for **SS Enterprises**. This application provides real-time field tracking, ABHA management tools, dynamic attendance logs, and administrative reporting.

---

## 🔑 Demo Access & Login Credentials

| Role | Username / ID | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `SS` | `ADMIN@12345` | Full Dashboard & Live Employee Map |
| **Field Employee** | `EMP101` | `SS@12345` | Work Tracking, Attendance & ABHA Portal |

---

## ✨ Key Features

* **Real-time Tracking:** Socket.IO & OpenStreetMap (Leaflet) integration for live employee location updates.
* **ABHA Tools:** Direct, seamless access to the official ABHA / ABDM Portal & App workflows.
* **Work & Attendance Logs:** One-click "Start Work" / "Close Work" with automatic timestamping.
* **Reporting & Analytics:** ABHA card counter, work-detail logs, and CSV export functionality for admins.
* **PWA Enabled:** Progressive Web App support for home-screen installation on mobile devices.
* **Data Security & Privacy:** Strict consent-based location sharing; zero unauthorized data scraping.

---

## 🛠️ Technical Stack & Architecture

* **Backend:** Node.js, Express.js, Socket.IO
* **Frontend:** HTML5, CSS3 (Luxury Theme), JavaScript (ES6+), Leaflet.js
* **Storage:** Local JSON (`data.json`) for quick demo deployments
* **Deployment:** Hosted via HTTPS on Render / GitHub Workflow

---

## 🚀 Quick Setup & Local Run

Ensure you have **Node.js (v18+)** installed on your system.

```bash
# 1. Clone or download the repository
git clone [https://github.com/your-username/your-repo.name.git](https://github.com/your-username/your-repo.name.git)

# 2. Install dependencies
npm install

# 3. Start the application
npm start
