import NextAuth from "next-auth";
import { authOptions } from "@/auth"; // Import your configurations object

// Initialize the Next-Auth v4 handler directly inside the API route
const handler = NextAuth(authOptions);

// Export native HTTP methods for the App Router engine
export { handler as GET, handler as POST };