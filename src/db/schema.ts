import { pgTable, serial, varchar, jsonb, timestamp, pgEnum, uuid, boolean, numeric, text } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';

// Role enum (use lowercase for consistency)
export const RoleEnum = pgEnum("role_enum", [
    "USER",
    "ADMIN",
    "MANAGER",
    "SUPER"
]);
export const SubscriptionStatusEnum = pgEnum("subscription_status_enum", [
    "active",
    "expired",
    "cancelled"
]);
export type SubscriptionStatusType  = typeof SubscriptionStatusEnum.enumValues[number];
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    mobile: text("mobile").notNull(),
    password: text("password"),
    role: RoleEnum("role").default("USER"),
    googleId: text("google_id"),
    facebookId: text("facebook_id"),
    appleId: text("apple_id"),
    subscription: jsonb("subscription").$type<{
        planId: string,
        status: SubscriptionStatusType,
        expiresAt: string;
    }>(),

    companies: jsonb("companies").$type<Array<{
        id: number;
        name: string;
        role: string;
    }>>(),
    selectedCompanyId: serial("selected_company_id").references(() => companies.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const otps = pgTable("otps", {
    id: serial("id").primaryKey(),
    mobile: text("mobile").notNull(),
    otp: text("otp").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    verified: boolean("verified").default(false),
});

export const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    gstin: varchar("gstin", { length: 20 }).notNull(),
    address: text("address"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Customers table with relation to company
export const customers = pgTable("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 128 }),
    phone: varchar("phone", { length: 32 }),
    address: jsonb("address"),
    gstin: varchar("gstin", { length: 20 }),
    balance: numeric("balance").default("0"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const bills = pgTable("bills", {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: varchar("customer_id", { length: 64 }).notNull(),
    customerName: varchar("customer_name", { length: 128 }).notNull(),
    amount: numeric("amount").notNull(),
    date: timestamp("date").notNull(),
    items: jsonb("items").notNull(), // Array of BillItem
    status: varchar("status", { length: 16 }).notNull(), // 'paid' | 'unpaid' | 'partial'
    dueDate: timestamp("due_date").notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id").notNull(), // Should reference bills.id
    companyId: uuid("company_id").notNull(), // Should reference companies.id
    amount: numeric("amount").notNull(),
    date: timestamp("date").notNull(),
    mode: varchar("mode", { length: 32 }).notNull(), // 'cash' | 'upi' | 'netbanking' | 'card' | 'cheque' | 'bankTransfer'
    status: varchar("status", { length: 16 }).notNull(), // 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled'
    reference: varchar("reference", { length: 128 }),
    notes: varchar("notes", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    date: timestamp("date").notNull(),
    description: varchar("description", { length: 255 }),
    debit: numeric("debit").default("0"),
    credit: numeric("credit").default("0"),
    account: varchar("account", { length: 100 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'journal' | 'ledger'
    reference: varchar("reference", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
});

export const gstTransactions = pgTable('gst_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id),
    billId: uuid('bill_id').references(() => bills.id),
    type: varchar('type', { length: 16 }).notNull(), // 'sales' | 'purchase'
    date: timestamp('date').notNull(),
    partyName: varchar('party_name', { length: 128 }),
    partyGstin: varchar('party_gstin', { length: 20 }),
    taxableAmount: numeric('taxable_amount').notNull(),
    totalTax: numeric('total_tax').notNull(),
    cgst: numeric('cgst').default('0'),
    sgst: numeric('sgst').default('0'),
    igst: numeric('igst').default('0'),
    total: numeric('total').notNull(),
    items: jsonb('items'),
    placeOfSupply: varchar('place_of_supply', { length: 64 }),
    reverseCharge: boolean('reverse_charge').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiInsights = pgTable('ai_insights', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id),
    type: varchar('type', { length: 32 }).notNull(), // e.g. 'tax_optimization', 'risk', 'trend'
    data: jsonb('data').notNull(), // AI result payload
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for all tables
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);

export const insertBillSchema = createInsertSchema(bills);
export const selectBillSchema = createSelectSchema(bills);

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);

export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);

export const insertOtpSchema = createInsertSchema(otps);
export const selectOtpSchema = createSelectSchema(otps);

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);

export const insertGstTransactionSchema = createInsertSchema(gstTransactions);
export const selectGstTransactionSchema = createSelectSchema(gstTransactions);

export const insertAiInsightSchema = createInsertSchema(aiInsights);
export const selectAiInsightSchema = createSelectSchema(aiInsights);

// Export types for all tables
export type InsertUsers = typeof users.$inferInsert;
export type SelectUsers = typeof users.$inferSelect;
export type InsertCompanies = typeof companies.$inferInsert;
export type SelectCompanies = typeof companies.$inferSelect;
export type InsertBills = typeof bills.$inferInsert;
export type SelectBills = typeof bills.$inferSelect;
export type InsertPayments = typeof payments.$inferInsert;
export type SelectPayments = typeof payments.$inferSelect;
export type InsertAccounts = typeof accounts.$inferInsert;
export type SelectAccounts = typeof accounts.$inferSelect;
export type InsertOTP = typeof otps.$inferInsert;
export type SelectOTP = typeof otps.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type InsertGSTTransaction = typeof gstTransactions.$inferInsert;
export type SelectGSTTransaction = typeof gstTransactions.$inferSelect;
export type InsertAIInsight = typeof aiInsights.$inferInsert;
export type SelectAIInsight = typeof aiInsights.$inferSelect;
export type RoleEnumType = typeof RoleEnum.enumValues[number];
export type SelectBill = typeof bills.$inferSelect;
export type SelectCompany = typeof companies.$inferSelect;
export type SelectPayment = typeof payments.$inferSelect;
