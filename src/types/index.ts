export enum RoleEnum {
    ADMIN = 'admin',
    USER = 'user',
    MANAGER = 'manager',
    SUPER_ADMIN = 'super_admin'
}

export interface Subscription {
    planId: string;
    status: 'active' | 'expired' | 'canceled';
    expiresAt: string; // ISO string for DB compatibility
}

export interface Address {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
}

export interface Contact {
    email: string;
    phone: string;
    website?: string;
}

export interface CompanySettings {
    currency: string;
    timezone: string;
    dateFormat: string;
    taxationSystem: 'gst' | 'vat' | 'none';
    financialYearStart: number;
}

export interface Company {
    id: number;
    userId: number;
    name: string;
    gstin?: string;
    address: Address;
    contact: Contact;
    settings: CompanySettings;
    createdAt: string;
    updatedAt: string;
}

export interface BillItem {
    name: string;
    quantity: number;
    price: number;
    total: number;
    gstRate?: number;
    hsnCode?: string;
}

export interface Bill {
    id: number;
    companyId: number;
    type: string;
    items: BillItem[];
    status: string;
    amount: number;
    createdAt: string;
}
