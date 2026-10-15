import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const server = new Server(
  { name: "xiaozhi-weather-mcp", version: "1.0.0" }, 
  { capabilities: { tools: {} } }
);

// ওপেন-ওয়েদার ম্যাপ এপিআই এর মূল ইউআরএল
const API_BASE_URL = "https://openweathermap.org";

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "get_weather_update",
    description: "যেকোনো শহরের নাম দিয়ে বর্তমান লাইভ আবহাওয়ার আপডেট ও তাপমাত্রা জানার টুল।",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "শহরের নাম (যেমন: Dhaka, Narsingdi)" }
      },
      required: ["city"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_weather_update") {
    // কোয়েব এর এনভায়রনমেন্ট ভেরিয়েবল থেকে সিক্রেট এপিআই কি-টি রিড করবে
    const apiKey = process.env.WEATHER_API_KEY;
    const city = request.params.arguments.city || "Dhaka";

    if (!apiKey) {
      return { content: [{ type: "text", text: "দুঃখিত, ব্যাকএন্ডে WEATHER_API_KEY সেট করা নেই।" }] };
    }

    try {
      const response = await axios.get(`${API_BASE_URL}?q=${city}&appid=${apiKey}&units=metric&lang=bn`);
      const data = response.data;
      
      const report = `${city} শহরের বর্তমান তাপমাত্রা ${data.main.temp}°C। আকাশ বর্তমানে ${data.weather[0].description} এবং বাতাসের আর্দ্রতা ${data.main.humidity}%।`;
      
      return { content: [{ type: "text", text: report }] };
    } catch (error) {
      return { content: [{ type: "text", text: `দুঃখিত, ${city} শহরের আবহাওয়া তথ্য এই মুহূর্তে খুঁজে পাওয়া যায়নি।` }] };
    }
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
