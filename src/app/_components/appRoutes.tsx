import {Home, LayoutDashboard, Store, Users} from "lucide-react";
import {JSX} from "react";

type AppRoute = {
    href: string;
    name: string;
    title: string;
    icon: JSX.Element;
    roles: string[]
}

export const APP_ROUTES:AppRoute[] = [
    {href: "/", name: "Домой", title:"Домашняя страница", icon: <Home />, roles: []},
    {href: "/users", name: "Пользователи", title:"Пользователи", icon: <Users />, roles: []},
    {href: "/dashboard", name: "Мониторинг", title:"Мониторинг", icon: <LayoutDashboard />, roles: []},
    {href: "/filial", name: "Филиал", title:"Филиал", icon: <Store />, roles: []},
    // {href: "/div", name: "Мониторинг дивизиона", icon: <Gauge />, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER"]},
    // {href: "/rrs", name: "Мониторинг РРС", icon: <Building2 />, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER","MANAGER"]},
    // {href: "/firm", name: "Мониторинг Филиала", icon: <HomeIcon/>, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER","MANAGER","DEPUTY_MANAGER"]},
    // {href: "/user", name: "Пользователь", icon: <UserRound />, roles: []},
    // {href: "/details", name: "Детализация по сотруднику", icon: <List />, roles: []},
]