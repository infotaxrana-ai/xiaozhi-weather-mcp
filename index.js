import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import http from "http";

// === Render Web Service Port Binding ===
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Xiaozhi Weather MCP Server is Live!");
}).listen(PORT, () => {
  console.log(`HTTP Health check server running on port ${PORT}`);
});

// === MCP Server Setup ===
const server = new Server(
  { name: "xiaozhi-weather-mcp", version: "1.0.0" }, 
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_weather",
      description: "নির্দিষ্ট শহর বা এলাকার (ডিফল্ট ঢাকা/নরসিংদী) লাইভ তাপমাত্রা, আবহাওয়া ও বিস্তারিত তথ্য পাওয়ার টুল।",
      inputSchema: {
        type: "object",
        properties: {
          city: { type: "string", description: "সিটির নাম (যেমন: Dhaka, Narsingdi, Sylhet, Chittagong)" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_weather") {
    // ডিফল্টভাবে ঢাকা (রানা ভাইয়ের লোকেশন) সেট করা, চাইলে ইউজার সিটি বদলাতে পারবে
    const cityName = args.city || "Dhaka";
    
    try {
      // প্রথমে শহরের জিও-কোড (Latitude & Longitude) বের করার ফ্রি এপিআই
      const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1`);
      
      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        return { content: [{ type: "text", text: `দুঃখিত রানা ভাই, "${cityName}" নামে কোনো স্থান খুঁজে পাওয়া যায়নি।` }] };
      }

      const location = geoRes.data.results[0];
      const { latitude, longitude, name: resolvedCity, country } = location;

      // এবার সেই লোকেশনের লাইভ আবহাওয়া ও বিস্তারিত ডেটা নেওয়ার ফ্রি এপিআই
      const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`);
      
      const current = weatherRes.data.current;
      
      // আবহাওয়া কোড ডিকোড করার সহজ লজিক
      const getWeatherCondition = (code) => {
        if (code === 0) return "আকাশ পরিষ্কার এবং রোদোজ্জ্বল ☀️";
        if (code >= 1 && code <= 3) return "আংশিক মেঘলা ⛅";
        if (code >= 51 && code <= 67) return "বষ্টিপাত হচ্ছে 🌧️";
        if (code >= 95) return "ঝড়ো হাওয়া ও বজ্রপাত ⛈️";
        return "স্বাভাবিক আবহাওয়া 🌤️";
      };

      const weatherReport = `📍 স্থান: ${resolvedCity}, ${country || 'Bangladesh'}
🌡️ তাপমাত্রা: ${current.temperature_2m}°C
👤 অনুভূত হচ্ছে: ${current.apparent_temperature}°C
💧 আর্দ্রতা (Humidity): ${current.relative_humidity_2m}%
💨 বাতাসের গতিবেগ: ${current.wind_speed_10m} কিমি/ঘণ্টা
🌧️ বৃষ্টিপাত: ${current.precipitation} মিমি
🌥️ আবহাওয়া পরিস্থিতি: ${getWeatherCondition(current.weather_code)}`;

      return { content: [{ type: "text", text: `রানা ভাই, ${resolvedCity} এর বর্তমান আবহাওয়া বিস্তারিত:\n\n${weatherReport}` }] };
      
    } catch (error) {
      return { content: [{ type: "text", text: "দুঃখিত রানা ভাই, আবহাওয়া সার্ভার থেকে ডেটা আনতে সাময়িক সমস্যা হয়েছে।" }] };
    }
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
