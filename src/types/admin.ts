export interface Role { id: number; name: string; description: string | null; }
export interface Mapping { id: number; ldap_position: string; role_name: string; role_id: number; }
export interface UserException { id: number; username: string; role_name: string; role_id: number; reason: string | null; }

export type AdminSectionType = 'ROLE' | 'MAPPING' | 'EXCEPTION';
