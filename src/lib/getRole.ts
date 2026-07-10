// TODO: Переписать  на получение массива ролей из БД
const roleTypes = [
    {role: "admin", description:"Глобальный администратор. Полный доступ, не может быть назначена вручную", canBeTransferred: false, access:100, maxAccess: 100},
    {role: "s_admin", description:"Администратор сервиса мотивации. Полный доступ, может быть назначена вручную глобальным администратором", canBeTransferred: false, access:99, maxAccess: 99},
    {role: "div_manager", description:"Дирекция дивизиона. Назначается автоматически или администратором уровня выше. Просмотр и редактирование: дивизион", canBeTransferred: false, access:50, maxAccess:50},
    {role: "rrs_manager", description:"Дирекция РРС. Назначается автоматически или администратором уровня выше. Просмотр: Дивизион, Редактирование: РРС", canBeTransferred: true, access:40, maxAccess:40},
    {role: "filial_manager", description:"Упрвляющий. Назначается автоматически или администратором уровня выше. Просмотр: РРС, Редактирование: Филиал", canBeTransferred: true, access:10, maxAccess:40},
    {role: "filial_dep_manager", description:"Зам.Упрвляющий. Назначается автоматически или администратором уровня выше. Просмотр: Филиал", canBeTransferred: false, access:9, maxAccess:10},
    {role: "user", description:"Просмотр: Филиал, Редактирование: Нет", canBeTransferred: false, access:1, maxAccess:1},
]

const roles = [
    {jobTitle: "Старший специалист по интеграции проектов дивизиона", role: "admin"},
    {jobTitle: "Менеджер по интеграции проектов дивизиона", role: "s_admin"},
    {jobTitle: "Специалист по интеграции проектов дивизиона", role: "user"}
]

export default function getRole(jobTitle:string):string|undefined{
    if (!jobTitle) return undefined

    return roles.find(r=>r.jobTitle === jobTitle)?.role
}