import { pgTable, serial, varchar, jsonb, timestamp, pgEnum, uuid, boolean, numeric, text } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

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

export const companies = pgTable("companies", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull(),
    gstin: varchar("gstin", { length: 20 }).notNull(),
    address: text("address"),
    createdBy: serial("created_by"),
    updatedBy: serial("updated_by"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    mobile: text("mobile").notNull(),
    password: text("password"),
    role: RoleEnum("role").default("USER").notNull(),
    googleId: text("google_id"),
    facebookId: text("facebook_id"),
    appleId: text("apple_id"),
    isProfileComplete: boolean("is_profile_complete").default(false),
    subscription: jsonb("subscription").$type<{
        planId: string,
        status: SubscriptionStatusType,
        expiresAt: string;
    }>(),
    companies: jsonb("companies").$type<Array<string>>(), // now array of uuid strings
    selectedCompanyId: uuid("selected_company_id").references(() => companies.id),
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

// Customers table with relation to company and user
export const customers = pgTable("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 128 }),
    phone: varchar("phone", { length: 32 }),
    address: jsonb("address"),
    gstin: varchar("gstin", { length: 20 }),
    balance: numeric("balance").default("0"),
    createdBy: serial("created_by").references(() => users.id), // FK to users
    updatedBy: serial("updated_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const bills = pgTable("bills", {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: varchar("customer_id", { length: 64 }).notNull(),
    customerName: varchar("customer_name", { length: 128 }).notNull(),
    amount: numeric("amount").notNull(),
    date: timestamp("date").notNull(),
    items: jsonb("items").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    dueDate: timestamp("due_date").notNull(),
    notes: varchar("notes", { length: 255 }),
    createdBy: serial("created_by").references(() => users.id), // FK to users
    updatedBy: serial("updated_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id").notNull().references(() => bills.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    amount: numeric("amount").notNull(),
    date: timestamp("date").notNull(),
    mode: varchar("mode", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    reference: varchar("reference", { length: 128 }),
    notes: varchar("notes", { length: 255 }),
    metadata: jsonb("metadata"),
    createdBy: serial("created_by").references(() => users.id), // FK to users
    updatedBy: serial("updated_by").references(() => users.id), // FK to users
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
    type: varchar("type", { length: 32 }).notNull(),
    reference: varchar("reference", { length: 100 }),
    createdBy: serial("created_by").references(() => users.id), // FK to users
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

// --- Drizzle Relations ---
export const usersRelations = relations(users, ({ many }) => ({
    companies: many(companies, {
        relationName: "userCompanies"
    }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
    creator: one(users, {
        fields: [companies.createdBy],
        references: [users.id],
        relationName: "creator"
    }),
    updater: one(users, {
        fields: [companies.updatedBy],
        references: [users.id],
        relationName: "updater"
    }),
    bills: many(bills),
    payments: many(payments),
    customers: many(customers),
    accounts: many(accounts),
    gstTransactions: many(gstTransactions),
    aiInsights: many(aiInsights)
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
    company: one(companies, {
        fields: [customers.companyId],
        references: [companies.id]
    }),
    creator: one(users, {
        fields: [customers.createdBy],
        references: [users.id]
    }),
    updater: one(users, {
        fields: [customers.updatedBy],
        references: [users.id]
    }),
    bills: many(bills),
    payments: many(payments),
    gstTransactions: many(gstTransactions),
    aiInsights: many(aiInsights)
}));

// Repeat similar for bills, payments, etc., relating to users and companies as appropriate
