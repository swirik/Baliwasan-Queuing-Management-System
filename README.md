# Barangay Baliwasan Digital Portal & Queuing System (Outdated)

A real-time **WebSocket-powered queuing management system and digital portal** built for **Barangay Baliwasan**.

This system enables residents to obtain queue tickets digitally while allowing barangay staff to manage queues and broadcast information through a centralized admin panel.

---

## Important Notice

This is a **full-stack Node.js application**.  
You **cannot open the HTML files directly** by double-clicking them.

The system requires the **Node.js backend server** to run in order to:

- Serve frontend files
    
- Handle WebSocket communication
    
- Maintain queue state across devices
    

---

# Prerequisites

Before running the system, ensure the following are installed on your machine:

- **Node.js** (v14.0 or higher)
    
- **Git**
    

You can verify Node.js installation by running:

node -v

---

# Project Structure

For the Express server to correctly route frontend files, the repository must follow this structure exactly.

If the HTML files are **not inside the `public` folder**, the server will return **404 errors**.

barangay-baliwasan-queue/  
│  
├── server.js  
├── package.json  
│  
└── public/  
    ├── index.html  
    ├── login.html  
    ├── admin.html  
    ├── queue.html  
    └── app.js

---

# Installation

Clone the repository:

git clone https://github.com/your-repository/barangay-baliwasan-queue.git

Navigate into the project folder:

cd barangay-baliwasan-queue

Install the required dependencies:

npm install express socket.io

---

# Running the Server

Start the application server with:

node server.js

If the terminal **returns to a blank line without errors**, the server is running and listening on **Port 3000**.

To stop the server:

Ctrl + C

---

# Accessing the System

The server binds to **0.0.0.0**, allowing any device on the **same Wi-Fi network** to connect.

---

## On the Host Computer

Open a browser and navigate to:

Main Portal

http://localhost:3000

Admin Control Panel

http://localhost:3000/admin.html

Public TV Monitor

http://localhost:3000/queue.html

Resident Kiosk

http://localhost:3000/login.html

---

## On Other Devices (Phones, Tablets, Smart TVs)

1. Find the **IPv4 Address** of the host computer running the server  
    Example:
    

192.168.1.15

2. Open a browser on the device.
    

Resident Kiosk

http://YOUR_IPV4_ADDRESS:3000/login.html

Admin Panel

http://YOUR_IPV4_ADDRESS:3000/admin.html

---

# System Workflow

## Resident Kiosk (`login.html`)

Residents:

- Enter personal details
    
- Select priority level (**Regular or PWD**)
    
- Choose transaction type
    

The system automatically:

- Generates a queue ticket
    
- Places the resident in the waiting list
    
- Simulates an SMS notification when the ticket is called
    

---

## Admin Panel (`admin.html`)

Barangay staff can:

- View the live waiting queue
    
- Issue **walk-in tickets**
    
- Call the next ticket to a specific **counter**
    
- Push **media content** (YouTube videos, images, or videos) to the public display
    
- Reset the entire queue system
    

---

## Public Display (`queue.html`)

Designed for a **large TV monitor**, this screen shows:

- The **currently called ticket**
    
- The **assigned service counter**
    
- The **live waiting list**
    
- Any **media broadcast by the admin**
    

Important:  
You must click **"Init Audio"** on first load to allow browser autoplay policies for audio playback.
