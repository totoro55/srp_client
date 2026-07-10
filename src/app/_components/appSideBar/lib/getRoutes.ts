import {route} from "@/types/route";

export default function getRoutes ({role="", user=""}:{role:string, user:string}):route|null {
    if (role==="" && user===""){
        //TODO: return default routes
        return null;
    }
    return null
}