# 🔱 SS ENTERPRISES — ABHA Work & Realtime Field Tracking Portal

Welcome to the official source code repository for **SS ENTERPRISES** real-time field work management, ABHA registration portal, and employee GPS tracking platform.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Key System Features](#-key-system-features)
3. [Architecture & Tech Stack](#-architecture--tech-stack)
4. [Project File Structure](#-project-file-structure)
5. [Default System Credentials](#-default-system-credentials)
6. [WebSocket (Socket.IO) API Reference](#-websocket-socketio-api-reference)
7. [Installation & Local Setup](#-installation--local-setup)
8. [Render.com Deployment Guide](#-rendercom-deployment-guide)
9. [PWA & Mobile Installation](#-pwa--mobile-installation)
10. [Data Management & Backup](#-data-management--backup)
11. [License & Branding](#-license--branding)

---

## 🎯 Project Overview
This portal is designed to streamline field operations for **SS ENTERPRISES**. It enables real-time location monitoring of field staff, tracks ABHA card processing counts, records customer work entries, and provides direct in-app access to official government ABHA services through a modern, responsive Web application.

---

## ✨ Key System Features

### 👑 Owner & Admin Capabilities
* **Live Employee Tracking:** Real-time interactive map views powered by Leaflet & OpenStreetMap.
* **Attendance & Status Monitoring:** Instant visual indicators for Online/Offline staff status.
* **Field Analytics:** View daily processed card totals, targeted areas, and active staff coordinates.
* **Data Control:** Comprehensive customer entry logs with administrative deletion authority.

### 👷 Employee & Field Staff Features
* **One-Tap Work Session:** Easy "Start Work" and "Close Work" daily operations.
* **Background GPS Location Sync:** Automatic latitude, longitude, and accuracy radius updates.
* **Customer Work Entry:** On-field entry of customer details, mobile numbers, and status.
* **In-App Portal Integration:** Direct seamless access to official ABHA registration tools.

### 📱 PWA & Performance
* **App-Like Experience:** Installable on Android and iOS devices.
* **Offline Asset Support:** Powered by custom Service Worker (`sw.js`) caching.
* **Native Status Bars:** Configured with luxury dark background aesthetics via `manifest.json`.
* **Zero-Lag Communication:** WebSockets eliminate page refreshes for all live actions.

---

## 🛠️ Architecture & Tech Stack

* **Backend Engine:** Node.js v18+ with Express framework.
* **Realtime Communication:** Socket.IO v4.x (WebSocket protocol with fallback).
* **Frontend UI:** HTML5, Modern CSS3 Flexbox/Grid, Vanilla JavaScript (ES6+).
* **Mapping Framework:** Leaflet JS with OpenStreetMap tiles.
* **Data Storage:** JSON-based persistent file storage (`data.json`).
* **Deployment Platform:** Render.com Web Services (Auto-deployment pipeline).

---

## 📂 Project File Structure

---

## 🔐 Default System Credentials

| Access Role | User ID / Login | Default Password | Permissions Level |
|---|---|---|---|
| **Owner / Admin** | `SS` | `ADMIN@12345` | Full Control, Maps, Deletion, Analytics |
| **Default Employee** | `EMP101` | `SS@12345` | Location Broadcast, ABHA Logging, Work Clock |

---

## 📡 WebSocket (Socket.IO) API Reference

| Event Name | Type | Payload Parameters | Description |
|---|---|---|---|
| `login` | Emit (Ack) | `{ role, id, password }` | Authenticates user and returns session token |
| `signup` | Emit (Ack) | `{ name, phone, area }` | Registers a new field employee |
| `startWork` | Emit (Ack) | `{ token }` | Sets employee status to Online and logs timestamp |
| `locationUpdate` | Emit | `{ token, lat, lng, accuracy }` | Updates real-time GPS coordinates |
| `addCustomer` | Emit (Ack) | `{ token, name, mobile, abha, area, status, remarks }` | Logs completed customer work entry |
| `deleteCustomer` | Emit (Ack) | `{ token, id }` | Owner-only deletion of work record |
| `closeWork` | Emit (Ack) | `{ token }` | Clock-out employee and update last seen |

---

## 🚀 Installation & Local Setup

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)
* **Git** installed on local system

### Setup Steps
1. **Clone Repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/ss-enterprises-abha-realtime-app.git](https://github.com/YOUR_USERNAME/ss-enterprises-abha-realtime-app.git)
   cd ss-enterprises-abha-realtime-app


## SS Enterprises v3 upgrade

This build keeps the existing login, staff work, GPS, ABHA customer entry, admin map and PWA structure, and adds:

- Hourly card updates: every submitted number is added to the employee total.
- District-wise team groups with simple group chat.
- District card summaries for the admin.
- Place-name reverse geocoding when network is available, plus GPS coordinates and Google Maps link.
- Offline/slow-network queue for card updates, customer entries, work status and location sync. Pending writes are saved on the device and retried when the connection returns.
- Duplicate protection for queued card/customer writes using client IDs.
- ABHA App launch attempt using the official Android package `in.ndhm.phr`, with official Play Store fallback; exact internal ABHA screen/deep-link is not assumed.
- Service-worker cache version bumped for the new UI.

### Important
The official ABHA portal/app still requires its own internet connection for server-side operations, login, OTP and authentication. Offline mode makes the SS Enterprises management layer resilient; it cannot make the official ABHA service work without internet.

### Render persistence
For production on Render, configure `DATA_DIR=/var/data` and attach a persistent disk so database data survives restarts.

## v3.1 Role Upgrade
- Owner/Admin: full Bihar-wide visibility and control.
- District Head: separate panel restricted to the assigned district.
- District Head can view only assigned-district staff, cards, locations and status, and can Enable/Disable/Logout staff in that district.
- Default demo District Head IDs: DH-DARBHANGA, DH-MADHUBANI, DH-SITAMARHI; password: HEAD@12345.
- Field Staff remain district-scoped through their assigned district.

For production deployment, replace demo passwords with secure hashed authentication and add server-side sessions/role authorization before handling real operational data.


Data preservation note: this package includes the previous data.json records merged into the upgraded data.json. Existing staff records and customer data are preserved.
