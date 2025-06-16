import { pgTable, integer, varchar, jsonb, timestamp, pgEnum, uuid, boolean, numeric, text } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

// Role enum (use lowercase for consistency)
export const RoleEnum = pgEnum("role_enum", [
    "guest",
    "user", 
    "staff",
    "manager",
    "admin",
    "developer"
]);
export const LedgerTypeEnum = pgEnum("ledger_type_enum", [
    "asset",
    "liability",
    "equity",
    "income",
    "expense"
])
export const SubscriptionStatusEnum = pgEnum("subscription_status_enum", [
    "active",
    "expired",
    "cancelled",
    "trial"
]);
export const SubscriptionPlanEnum = pgEnum("subscription_plan_enum", [
    "free",
    "basic", 
    "premium",
    "unlimited"
]);
export const SalesTypeEnum = pgEnum("sales_type_enum", [
    "sale",
    "purchase",
]);
export const aiInsightTypeEnums = pgEnum('aiInsights_type', ['tax_optimization', 'risk', 'trend', 'forecast', 'expense_analysis']);
export const AuthProviderEnum = pgEnum("auth_provider_enum", [
    "email",
    "google",
    "facebook",
    "apple"
]);
export const NotificationTypeEnum = pgEnum("notification_type_enum", [
    "bill_reminder",
    "payment_received", 
    "subscription_expiry",
    "system_update",
    "promotional"
]);
export const SyncStatusEnum = pgEnum("sync_status_enum", [
    "pending",
    "synced",
    "failed",
    "conflict"
]);

// Enum types
export type SubscriptionPlanType = typeof SubscriptionPlanEnum.enumValues[number];
export type AuthProviderType = typeof AuthProviderEnum.enumValues[number];
export type NotificationTypeType = typeof NotificationTypeEnum.enumValues[number];
export type SyncStatusType = typeof SyncStatusEnum.enumValues[number];
export type SubscriptionStatusType  = typeof SubscriptionStatusEnum.enumValues[number];
export type RoleType = typeof RoleEnum.enumValues[number];
export type SalesType = typeof SalesTypeEnum.enumValues[number];
export type AiInsightType = typeof aiInsightTypeEnums.enumValues[number];

export const companies = pgTable("companies", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    gstin: varchar("gstin", { length: 20 }).notNull(),
    address: text("address"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name"),
    email: text("email"),
    mobile: text("mobile"),
    password: text("password"),
    role: RoleEnum("role").default("user").notNull(),
    authProvider: AuthProviderEnum("auth_provider").default("email").notNull(),
    googleId: text("google_id"),
    facebookId: text("facebook_id"),
    appleId: text("apple_id"),
    isGuest: boolean("is_guest").default(false),
    isProfileComplete: boolean("is_profile_complete").default(false),
    isEmailVerified: boolean("is_email_verified").default(false),
    isMobileVerified: boolean("is_mobile_verified").default(false),
    avatar: text("avatar"),
    preferences: jsonb("preferences").$type<{
        theme: 'light' | 'dark' | 'system';
        language: string;
        currency: string;
        dateFormat: string;
        notifications: boolean;
        animations: boolean;
    }>().default({
        theme: 'system',
        language: 'en',
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        notifications: true,
        animations: true
    }),
    subscription: jsonb("subscription").$type<{
        plan: SubscriptionPlanType;
        status: SubscriptionStatusType;
        expiresAt: string;
        companiesLimit: number;
        features: string[];
    }>().default({
        plan: SubscriptionPlanEnum.enumValues[0],
        status: SubscriptionStatusEnum.enumValues[0],
        expiresAt: '',
        companiesLimit: 1,
        features: []
    }),
    lastLoginAt: timestamp("last_login_at"),
    deviceInfo: jsonb("device_info"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const otps = pgTable("otps", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    identifier: text("identifier").notNull(), // email or mobile
    type: varchar("type", { length: 10 }).notNull(), // 'email' or 'sms'
    otp: text("otp").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    verified: boolean("verified").default(false),
});

// Company members table for role-based access
export const companyMembers = pgTable("company_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: RoleEnum("role").default("staff").notNull(),
    permissions: jsonb("permissions").$type<{
        canCreateBills: boolean;
        canEditBills: boolean;
        canDeleteBills: boolean;
        canViewReports: boolean;
        canManageCustomers: boolean;
        canManageProducts: boolean;
        canManagePayments: boolean;
        canManageSettings: boolean;
    }>().default({
        canCreateBills: true,
        canEditBills: false,
        canDeleteBills: false,
        canViewReports: false,
        canManageCustomers: false,
        canManageProducts: false,
        canManagePayments: false,
        canManageSettings: false
    }),
    invitedBy: integer("invited_by").references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Products table
export const products = pgTable("products", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    category: varchar("category", { length: 100 }),
    unit: varchar("unit", { length: 50 }).default("pcs"),
    sellingPrice: numeric("selling_price").notNull(),
    costPrice: numeric("cost_price"),
    mrp: numeric("mrp"),
    stock: integer("stock").default(0),
    minStock: integer("min_stock").default(0),
    maxStock: integer("max_stock"),
    taxRate: numeric("tax_rate").default("0"),
    hsnCode: varchar("hsn_code", { length: 20 }),
    images: jsonb("images").$type<string[]>().default([]),
    isActive: boolean("is_active").default(true),
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Offline sync table
export const offlineSync = pgTable("offline_sync", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    tableName: varchar("table_name", { length: 100 }).notNull(),
    recordId: varchar("record_id", { length: 100 }).notNull(),
    operation: varchar("operation", { length: 20 }).notNull(), // 'create', 'update', 'delete'
    data: jsonb("data").notNull(),
    status: SyncStatusEnum("status").default("pending").notNull(),
    deviceId: varchar("device_id", { length: 100 }),
    conflictData: jsonb("conflict_data"),
    createdAt: timestamp("created_at").defaultNow(),
    syncedAt: timestamp("synced_at"),
});

// Notifications table
export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    type: NotificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    data: jsonb("data"),
    isRead: boolean("is_read").default(false),
    isGlobal: boolean("is_global").default(false),
    scheduledFor: timestamp("scheduled_for"),
    createdAt: timestamp("created_at").defaultNow(),
});

// File uploads table
export const fileUploads = pgTable("file_uploads", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    url: text("url"),
    category: varchar("category", { length: 50 }), // 'avatar', 'bill', 'product', 'document'
    isCompressed: boolean("is_compressed").default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
});

// Ledger accounts table
export const ledgerAccounts = pgTable("ledger_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }),
    type: LedgerTypeEnum("type").notNull(), // 'asset', 'liability', 'equity', 'income', 'expense'
    subType: varchar("sub_type", { length: 50 }),
    openingBalance: numeric("opening_balance").default("0"),
    currentBalance: numeric("current_balance").default("0"),
    isActive: boolean("is_active").default(true),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Bill templates table
export const billTemplates = pgTable("bill_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    template: jsonb("template").notNull(),
    isDefault: boolean("is_default").default(false),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Customers table with relation to company and user
export const customers = pgTable("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 128 }),
    phone: varchar("phone", { length: 32 }),
    address: jsonb("address"),
    gstin: varchar("gstin", { length: 20 }),
    contactPerson: varchar("contact_person", { length: 128 }),
    creditLimit: numeric("credit_limit").default("0"),
    paymentTerms: integer("payment_terms").default(30), // days
    isActive: boolean("is_active").default(true),
    totalBills: integer("total_bills").default(0),
    totalAmount: numeric("total_amount").default("0"),
    outstandingAmount: numeric("outstanding_amount").default("0"),
    lastTransactionDate: timestamp("last_transaction_date"),
    balance: numeric("balance").default("0"),
    createdBy: integer("created_by").references(() => users.id), // FK to users
    updatedBy: integer("updated_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const bills = pgTable("bills", {
    id: uuid("id").primaryKey().defaultRandom(),
    billNumber: varchar("bill_number").notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade", onUpdate: "cascade" }),
    customerName: varchar("customer_name").notNull(),
    customerGstin: varchar("customer_gstin", { length: 20 }),
    customerAddress: text("customer_address"),
    customerPhone: varchar("customer_phone", { length: 32 }),
    customerEmail: varchar("customer_email", { length: 128 }),
    amount: numeric("amount").notNull(),
    taxAmount: numeric("tax_amount").default("0"),
    totalAmount: numeric("total_amount").notNull(),
    date: timestamp("date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    items: jsonb("items").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    paymentStatus: varchar("payment_status", { length: 16 }).notNull().default("pending"),
    paymentMethod: varchar("payment_method", { length: 32 }),
    notes: text("notes"),
    terms: text("terms"),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade", onUpdate: "cascade" }),
    cgst: numeric("cgst").default("0"),
    sgst: numeric("sgst").default("0"),
    igst: numeric("igst").default("0"),
    discount: numeric("discount").default("0"),
    discountType: varchar("discount_type", { length: 16 }).default("amount"),
    createdBy: integer("created_by").references(() => users.id), // FK to users
    updatedBy: integer("updated_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id").notNull().references(() => bills.id),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    amount: numeric("amount").notNull(),
    date: timestamp("date").notNull(),
    mode: varchar("mode", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    reference: varchar("reference", { length: 128 }),
    notes: varchar("notes", { length: 255 }),
    metadata: jsonb("metadata"),
    createdBy: integer("created_by").references(() => users.id), // FK to users
    updatedBy: integer("updated_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    date: timestamp("date").notNull(),
    description: varchar("description", { length: 255 }),
    debit: numeric("debit").default("0"),
    credit: numeric("credit").default("0"),
    account: varchar("account", { length: 100 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    reference: varchar("reference", { length: 100 }),
    createdBy: integer("created_by").references(() => users.id), // FK to users
    createdAt: timestamp("created_at").defaultNow(),
});

export const gstTransactions = pgTable('gst_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id),
    billId: uuid('bill_id').references(() => bills.id),
    type:SalesTypeEnum('type').notNull(),
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
    type: aiInsightTypeEnums('type').notNull(),
    data: jsonb('data').notNull(), // AI result payload
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for all tables
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);

export const insertCompanyMemberSchema = createInsertSchema(companyMembers);
export const selectCompanyMemberSchema = createSelectSchema(companyMembers);

export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);

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

export const insertOfflineSyncSchema = createInsertSchema(offlineSync);
export const selectOfflineSyncSchema = createSelectSchema(offlineSync);

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);

export const insertFileUploadSchema = createInsertSchema(fileUploads);
export const selectFileUploadSchema = createSelectSchema(fileUploads);

export const insertLedgerAccountSchema = createInsertSchema(ledgerAccounts);
export const selectLedgerAccountSchema = createSelectSchema(ledgerAccounts);

export const insertBillTemplateSchema = createInsertSchema(billTemplates);
export const selectBillTemplateSchema = createSelectSchema(billTemplates);

// Export types for all tables
export type InsertUsers = typeof users.$inferInsert;
export type SelectUsers = typeof users.$inferSelect;
export type InsertCompanies = typeof companies.$inferInsert;
export type SelectCompanies = typeof companies.$inferSelect;
export type InsertCompanyMembers = typeof companyMembers.$inferInsert;
export type SelectCompanyMembers = typeof companyMembers.$inferSelect;
export type InsertProducts = typeof products.$inferInsert;
export type SelectProducts = typeof products.$inferSelect;
export type InsertBills = typeof bills.$inferInsert;
export type SelectBills = typeof bills.$inferSelect;
export type InsertPayments = typeof payments.$inferInsert;
export type SelectPayments = typeof payments.$inferSelect;
export type InsertAccounts = typeof accounts.$inferInsert;
export type SelectAccounts = typeof accounts.$inferSelect;
export type InsertOTP = typeof otps.$inferInsert;
export type SelectOTP = typeof otps.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type SelectCustomer = typeof customers.$inferSelect;
export type InsertGSTTransaction = typeof gstTransactions.$inferInsert;
export type SelectGSTTransaction = typeof gstTransactions.$inferSelect;
export type InsertAIInsight = typeof aiInsights.$inferInsert;
export type SelectAIInsight = typeof aiInsights.$inferSelect;
export type InsertOfflineSync = typeof offlineSync.$inferInsert;
export type SelectOfflineSync = typeof offlineSync.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type InsertFileUpload = typeof fileUploads.$inferInsert;
export type SelectFileUpload = typeof fileUploads.$inferSelect;
export type InsertLedgerAccount = typeof ledgerAccounts.$inferInsert;
export type SelectLedgerAccount = typeof ledgerAccounts.$inferSelect;
export type InsertBillTemplate = typeof billTemplates.$inferInsert;
export type SelectBillTemplate = typeof billTemplates.$inferSelect;


// Convenience types
export type SelectBill = typeof bills.$inferSelect;
export type SelectCompany = typeof companies.$inferSelect;
export type SelectPayment = typeof payments.$inferSelect;
export type SelectUser = typeof users.$inferSelect;
export type SelectProduct = typeof products.$inferSelect;

// --- Drizzle Relations ---
export const usersRelations = relations(users, ({ many }) => ({
    companies: many(companies, {
        relationName: "userCompanies"
    }),
    companyMemberships: many(companyMembers),
    customers: many(customers),
    payments: many(payments),
    products: many(products),
    notifications: many(notifications),
    fileUploads: many(fileUploads),
    offlineSync: many(offlineSync)
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
    members: many(companyMembers),
    bills: many(bills),
    payments: many(payments),
    customers: many(customers),
    products: many(products),
    accounts: many(accounts),
    gstTransactions: many(gstTransactions),
    aiInsights: many(aiInsights),
    notifications: many(notifications),
    fileUploads: many(fileUploads),
    ledgerAccounts: many(ledgerAccounts),
    billTemplates: many(billTemplates)
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
    company: one(companies, {
        fields: [companyMembers.companyId],
        references: [companies.id]
    }),
    user: one(users, {
        fields: [companyMembers.userId],
        references: [users.id]
    }),
    inviter: one(users, {
        fields: [companyMembers.invitedBy],
        references: [users.id]
    })
}));

export const productsRelations = relations(products, ({ one }) => ({
    company: one(companies, {
        fields: [products.companyId],
        references: [companies.id]
    }),
    creator: one(users, {
        fields: [products.createdBy],
        references: [users.id]
    }),
    updater: one(users, {
        fields: [products.updatedBy],
        references: [users.id]
    })
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
    user: one(users, {
        fields: [customers.userId],
        references: [users.id]
    }),
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
    bills: many(bills)
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
    customer: one(customers, {
        fields: [bills.customerId],
        references: [customers.id]
    }),
    company: one(companies, {
        fields: [bills.companyId],
        references: [companies.id]
    }),
    creator: one(users, {
        fields: [bills.createdBy],
        references: [users.id]
    }),
    updater: one(users, {
        fields: [bills.updatedBy],
        references: [users.id]
    }),
    payments: many(payments),
    gstTransactions: many(gstTransactions)
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    bill: one(bills, {
        fields: [payments.billId],
        references: [bills.id]
    }),
    company: one(companies, {
        fields: [payments.companyId],
        references: [companies.id]
    }),
    user: one(users, {
        fields: [payments.userId],
        references: [users.id]
    }),
    creator: one(users, {
        fields: [payments.createdBy],
        references: [users.id]
    }),
    updater: one(users, {
        fields: [payments.updatedBy],
        references: [users.id]
    })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id]
    }),
    company: one(companies, {
        fields: [notifications.companyId],
        references: [companies.id]
    })
}));

export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
    user: one(users, {
        fields: [fileUploads.userId],
        references: [users.id]
    }),
    company: one(companies, {
        fields: [fileUploads.companyId],
        references: [companies.id]
    })
}));

export const offlineSyncRelations = relations(offlineSync, ({ one }) => ({
    user: one(users, {
        fields: [offlineSync.userId],
        references: [users.id]
    }),
    company: one(companies, {
        fields: [offlineSync.companyId],
        references: [companies.id]
    })
}));

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one, many }) => ({
    company: one(companies, {
        fields: [ledgerAccounts.companyId],
        references: [companies.id]
    }),
    creator: one(users, {
        fields: [ledgerAccounts.createdBy],
        references: [users.id]
    }),
    children: many(ledgerAccounts)
}));

export const billTemplatesRelations = relations(billTemplates, ({ one }) => ({
    company: one(companies, {
        fields: [billTemplates.companyId],
        references: [companies.id]
    }),
    creator: one(users, {
        fields: [billTemplates.createdBy],
        references: [users.id]
    })
}));

