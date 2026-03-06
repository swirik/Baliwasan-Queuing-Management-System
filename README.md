Barangay Baliwasan Digital Portal & Queuing System
A real-time, WebSocket-powered queuing management system and digital portal built for Barangay Baliwasan.
⚠️ Important Warning
This is a full-stack Node.js application. You cannot simply double-click the HTML files to open them. The system requires the backend server to be running to serve the files and handle the WebSocket state management.

Prerequisites
Before you begin, you must have the following installed on your host machine:

Node.js (v14.0 or higher)

Git ## 1. Directory Structure
For the Express server to route the frontend files correctly, your repository must be structured exactly like this. If the HTML files are not inside the public folder, the server will throw 404 errors.

Plaintext
/barangay-baliwasan-queue
│-- server.js
│-- package.json 
└── public/
    │-- index.html     
    │-- login.html      
    │-- admin.html      
    │-- queue.html      
    └── app.js          
2. Installation
Clone this repository to your local machine.

Open your terminal or command prompt and navigate directly into the project folder.

Install the required backend dependencies (express and socket.io):

Bash
npm install express socket.io
3. Activation (Running the Server)
To start the queuing system engine, run the following command in your terminal:

Bash
node server.js
Note: The terminal will not output a success message. If the cursor drops to a new blank line and sits there, the server is actively listening on Port 3000.

To stop the server, press Ctrl + C in the terminal.

4. Usage & Routing
Because the server is bound to 0.0.0.0, it is accessible to any device connected to the exact same Wi-Fi network as the host computer.

On the Host Computer:
Open your web browser and navigate to:

Main Portal: http://localhost:3000

Admin Control Panel: http://localhost:3000/admin.html

Public TV Monitor: http://localhost:3000/queue.html

Resident Kiosk: http://localhost:3000/login.html

On Other Network Devices (Smartphones, Tablets, Smart TVs):
Find the IPv4 Address of the host computer running the Node server (e.g., 192.168.1.15).

Open the browser on the mobile device/tablet.

Navigate to http://YOUR_IPV4_ADDRESS:3000/login.html to access the resident ticket kiosk.

Navigate to http://YOUR_IPV4_ADDRESS:3000/admin.html to allow staff to control the queue from a tablet.

System Workflow
Resident Kiosk (login.html): Residents input their details, select their priority (Regular or PWD), and choose their transaction type. The system assigns a ticket and simulates an SMS notification when called.

Admin Panel (admin.html): Staff view the waiting list. They can issue walk-in tickets, call the next ticket to specific counters, push media (YouTube/Video/Images) to the public display, and reset the entire queue.

Public Display (queue.html): A view-only monitor meant for a large TV. It displays the currently called ticket, flashes the designated counter, shows the waiting list, and broadcasts any media pushed by the admin. You must click "Init Audio" upon first load to allow browser audio autoplay policies.
