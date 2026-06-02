// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
// /* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable */
import { io } from 'socket.io-client';
import axios from "axios";
import * as https from "https"; 

console.log("🚀 Simulation script starting...");

// const API_URL = "http://127.0.0.1:3001/api"; // Your NestJS API
const API_URL = "https://localhost/api"; // Your NestJS API
const WS_URL = "https://localhost/chat";  // Your NestJS Gateway

const httpsAgent = new https.Agent({  
  rejectUnauthorized: false
});

  
  // const conversationId = `room-${index % 25}`;

  // console.log(`[User ${index}] Attempting to register/login...`);

async function simulateUserPair(index: number) {
  try {
    // 1. Setup two users: User A and User B
    const userA = { username: `test_user_${index}`, email: `test_user_${index}@mail.com`,
      password: `Password123!`};
    const userB = { username: `test_user_${index + 1}`, email: `test_user_${index + 1}@mail.com`,
      password: `Password123!`};


    // 2. Try to Register (ignore error if user already exists)
    try {
      await axios.post(`${API_URL}/auth/register`, {
        username: userA.username,
        email: userA.email,
        password: userA.password,
      }, { httpsAgent });
      console.log(`[User ${index}] Registered successfully`);
    } catch (e: any) {
      // Check if it's a "User Exists" error (usually 400 or 409)
      if (e.response && (e.response.status === 400 || e.response.status === 409)) {
        console.log(`[User ${index}] User already exists, proceeding to login...`);
      } else {
        // If it's a connection error, throw it to the outer catch
        throw e; 
      }
    }
    try {
      await axios.post(`${API_URL}/auth/register`, {
        username: userB.username,
        email: userB.email,
        password: userB.password,
      }, { httpsAgent });
      console.log(`[User ${index + 1}] Registered successfully`);
    } catch (e: any) {
      // Check if it's a "User Exists" error (usually 400 or 409)
      if (e.response && (e.response.status === 400 || e.response.status === 409)) {
        console.log(`[User ${index + 1}] User already exists, proceeding to login...`);
      } else {
        // If it's a connection error, throw it to the outer catch
        throw e; 
      }
    }

    // 3. Login to get the JWT
    const loginA = await axios.post(`${API_URL}/auth/login`, {
      email: userA.email,
      password: userA.password,
    }, { httpsAgent });
    const loginB = await axios.post(`${API_URL}/auth/login`, {
      email: userB.email,
      password: userB.password,
    }, { httpsAgent });

    const tokenA = loginA.data.accessToken;
    const tokenB = loginB.data.accessToken;
    const cuidB = loginB.data.user.id;

    // 4. Create/Get the Direct Conversation via HTTP
    // (Assuming you have an endpoint that calls chatService.createOrGetDirectConversation)
    const convRes = await axios.post(`${API_URL}/chat/direct/${cuidB}`, {}, { 
        headers: { Authorization: `Bearer ${tokenA}` },
        httpsAgent 
    });

    const conversationId = convRes.data.id; // This is the real CUID from Postgres

    // 4. Connect both users to the Socket
    const socketA = io(WS_URL, { auth: { token: tokenA }, transports: ['websocket'], rejectUnauthorized: false });
    const socketB = io(WS_URL, { auth: { token: tokenB }, transports: ['websocket'], rejectUnauthorized: false });

    socketA.on('connect', () => {
      
      console.log(`✅ User ${index} connected to Conv: ${conversationId}. Waiting for handshake to finish...`);
      
      // 5. Send Message (Using 'conversationId' and 'content' keys)
      socketA.emit('chat.sendMessage', {
        conversationId: conversationId,
        content: `Hi User ${index + 1}, I am User ${index}. Let's test concurrency!`
      });
      socketB.emit('chat.sendMessage', {
        conversationId: conversationId,
        content: `Hi User ${index}, I am User ${index + 1}. That's a good idea!`
      });
    });
    let messagesSent = 0;
    const interval = setInterval(() => {
      socketA.emit('chat.sendMessage', {
        conversationId: conversationId, // Use the Conversation CUID, not User CUID
        content: `Automatic message from user ${index} at ${new Date().toLocaleTimeString()}`
      });
      messagesSent++;

      // Stop after 5 messages
      if (messagesSent >= 5) {
        clearInterval(interval);
        socketA.disconnect(); // Close the connection
        console.log(`[User ${index}] Finished and disconnected.`);
        socketB.disconnect(); // Close the connection
        console.log(`[User ${index + 1}] Finished and disconnected.`);
      }
    }, 3000);

    socketA.on('exception', (err) => console.error(`⚠️ Socket Error:`, err));

  } catch (error: any) {
    console.error(`❌ Error in pair ${index}:`, error.response?.data?.message || error.message);
  }
}

// Launch 50 users with a slight delay between them to avoid slamming the CPU
console.log(
  'Launch 50 users with a slight delay between them to avoid slamming the CPU...',
);
for (let i = 0; i < 50; i+=2) {
  setTimeout(() => simulateUserPair(i), i * 1); 
}

console.log('⏳ Scheduled 50 users. Waiting for connections...'); // ADD THIS

// This keeps the script alive so it doesn't exit immediately
setInterval(() => {}, 1000);
