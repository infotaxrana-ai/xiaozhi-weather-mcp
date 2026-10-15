import WebSocket from "ws";
import http from "http";
import axios from "axios";

const PORT = process.env.PORT || 10000;
const XIAOZHI_WSS_URL = "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMzIwNzcsImFnZW50SWQiOjI0OTc5NTgsImVuZHBvaW50SWQiOiJhZ2VudF8yNDk3OTU4IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc5MjA0NTAyMywiZXhwIjoxODIzNjAyNjIzfQ.IxfB-uqYWVbFWRTVjvDXaQ8BF1yUb_kbC1-iRzcYKVpw1RbpXNf1JizO37DWz8__B64iUC0FUDF2M00FSjI5aA";

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Xiaozhi Weather MCP is Live!");
}).listen(PORT, () => console.log(`Health check on port ${PORT}`));

function connect() {
  const ws = new WebSocket(XIAOZHI_WSS_URL);
  ws.on("open", () => console.log("Connected Weather MCP to Xiaozhi!"));

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.method === "tools/list") {
        ws.send(JSON.stringify({
          jsonrpc: "2.0", id: msg.id,
          result: {
            tools: [{
              name: "get_weather",
              description: "লাইভ আবহাওয়া ও তাপমাত্রার তথ্য পাওয়ার টুল।",
              inputSchema: {
                type: "object",
                properties: { city: { type: "string", description: "শহরের নাম (যেমন: Dhaka, Narsingdi)" } }
              }
            }]
          }
        }));
      }

      if (msg.method === "tools/call" && msg.params?.name === "get_weather") {
        const cityName = msg.params.arguments?.city || "Dhaka";
        try {
          const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1`);
          if (!geoRes.data.results?.length) {
            return ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `রানা ভাই, "${cityName}" শহরটি খুঁজে পাওয়া যায়নি।` }] } }));
          }
          const loc = geoRes.data.results[0];
          const wRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`);
          const cur = wRes.data.current;

          const report = `📍 স্থান: ${loc.name}, ${loc.country || 'Bangladesh'}\n🌡️ তাপমাত্রা: ${cur.temperature_2m}°C\n👤 অনুভূত হচ্ছে: ${cur.apparent_temperature}°C\n💧 আর্দ্রতা: ${cur.relative_humidity_2m}%\n💨 বাতাসের গতি: ${cur.wind_speed_10m} কিমি/ঘণ্টা`;
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `রানা ভাই, ${loc.name} এর লাইভ আবহাওয়া:\n\n${report}` }] } }));
        } catch (e) {
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "Weather fetch failed" } }));
        }
      }
    } catch (e) {}
  });

  ws.on("close", () => setTimeout(connect, 5000));
}
connect();
