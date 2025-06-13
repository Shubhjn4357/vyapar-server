# Vyapar Server

A comprehensive business management API server built with Fastify, TypeScript, and Drizzle ORM. This server provides robust backend services for the Vyapar mobile application, handling authentication, company management, billing, inventory, and more.

## 🚀 Features

### Core Features
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Multi-Company Support**: Users can manage multiple companies with subscription-based limits
- **Subscription Management**: Free, Basic, and Premium plans with feature restrictions
- **Social Authentication**: Google and Facebook login integration
- **OTP Verification**: Mobile number verification for secure authentication
- **Real-time Data**: Fast API responses with optimized database queries

### Business Features
- **Company Management**: Create, update, and manage multiple companies
- **Customer Management**: Comprehensive customer database with contact details
- **Product/Inventory Management**: Track products, stock levels, and pricing
- **Billing System**: Generate invoices, estimates, and manage billing cycles
- **Payment Tracking**: Record and track payments, outstanding amounts
- **GST Compliance**: GST calculations and reporting features
- **Reports & Analytics**: Business insights and financial reports

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (High-performance web framework)
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Authentication**: JWT tokens with bcryptjs for password hashing
- **Validation**: Zod for runtime type validation
- **Social Auth**: Google Auth Library for OAuth integration

### Project Structure

```
src/
├── config/
│   └── drizzle.config.ts      # Database configuration
├── db/
│   ├── drizzle.ts             # Database connection setup
│   └── schema.ts              # Database schema definitions
├── plugins/
│   ├── auth.ts                # Authentication middleware
│   └── roleGuard.ts           # Role-based access control
├── routes/
│   ├── api.ts                 # Main API routes registration
│   ├── auth.ts                # Authentication endpoints
│   ├── bills.ts               # Billing and invoice management
│   ├── companies.ts           # Company management
│   ├── customers.ts           # Customer management
│   ├── gst.ts                 # GST-related operations
│   ├── payments.ts            # Payment tracking
│   ├── products.ts            # Product/inventory management
│   ├── reports.ts             # Analytics and reporting
│   └── user.ts                # User profile management
├── types/
│   └── fastify.d.ts           # TypeScript type definitions
├── utils/
│   ├── jwt.ts                 # JWT token utilities
│   ├── otp.ts                 # OTP generation and verification
│   ├── socialAuth.ts          # Social authentication helpers
│   └── subscription.ts       # Subscription management utilities
└── index.ts                   # Application entry point
```

## 📡 API Routes

### Authentication Routes (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | User registration | No |
| POST | `/login` | User login | No |
| POST | `/otp/request` | Request OTP for mobile verification | No |
| POST | `/otp/verify` | Verify OTP | No |
| POST | `/reset-password` | Reset password with OTP | No |
| POST | `/refresh` | Refresh JWT token | Yes |
| POST | `/social/google` | Google OAuth login | No |
| POST | `/social/facebook` | Facebook OAuth login | No |

### User Management (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profile` | Get user profile | Yes |
| PUT | `/profile` | Update user profile | Yes |
| POST | `/complete-profile` | Complete user profile setup | Yes |
| DELETE | `/account` | Delete user account | Yes |

### Company Management (`/companies`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| POST | `/add` | Create new company | Yes | Free+ |
| GET | `/` | Get user's companies | Yes | Free+ |
| GET | `/:id` | Get company details | Yes | Free+ |
| PUT | `/:id` | Update company | Yes | Free+ |
| DELETE | `/:id` | Delete company | Yes | Free+ |

### Customer Management (`/customers`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| POST | `/add` | Add new customer | Yes | Free+ |
| GET | `/` | Get all customers | Yes | Free+ |
| GET | `/:id` | Get customer details | Yes | Free+ |
| PUT | `/:id` | Update customer | Yes | Free+ |
| DELETE | `/:id` | Delete customer | Yes | Free+ |
| GET | `/search` | Search customers | Yes | Basic+ |

### Product Management (`/products`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| POST | `/add` | Add new product | Yes | Free+ |
| GET | `/` | Get all products | Yes | Free+ |
| GET | `/:id` | Get product details | Yes | Free+ |
| PUT | `/:id` | Update product | Yes | Free+ |
| DELETE | `/:id` | Delete product | Yes | Free+ |
| POST | `/bulk-import` | Bulk import products | Yes | Premium |
| GET | `/low-stock` | Get low stock alerts | Yes | Basic+ |

### Billing & Invoices (`/bills`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| POST | `/create` | Create new bill/invoice | Yes | Free+ |
| GET | `/` | Get all bills | Yes | Free+ |
| GET | `/:id` | Get bill details | Yes | Free+ |
| PUT | `/:id` | Update bill | Yes | Free+ |
| DELETE | `/:id` | Delete bill | Yes | Free+ |
| POST | `/:id/send` | Send bill via email/SMS | Yes | Basic+ |
| GET | `/templates` | Get bill templates | Yes | Premium |

### Payment Tracking (`/payments`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| POST | `/record` | Record payment | Yes | Free+ |
| GET | `/` | Get payment history | Yes | Free+ |
| GET | `/:id` | Get payment details | Yes | Free+ |
| PUT | `/:id` | Update payment | Yes | Free+ |
| GET | `/outstanding` | Get outstanding payments | Yes | Basic+ |
| POST | `/reminders` | Send payment reminders | Yes | Premium |

### GST & Tax (`/gst`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| GET | `/rates` | Get GST rates | Yes | Free+ |
| POST | `/calculate` | Calculate GST for transaction | Yes | Free+ |
| GET | `/returns/gstr1` | Generate GSTR-1 report | Yes | Basic+ |
| GET | `/returns/gstr3b` | Generate GSTR-3B report | Yes | Premium |
| POST | `/file-return` | File GST return | Yes | Premium |

### Reports & Analytics (`/reports`)

| Method | Endpoint | Description | Auth Required | Subscription |
|--------|----------|-------------|---------------|--------------|
| GET | `/sales` | Sales reports | Yes | Basic+ |
| GET | `/profit-loss` | P&L statement | Yes | Basic+ |
| GET | `/cash-flow` | Cash flow report | Yes | Premium |
| GET | `/tax-summary` | Tax summary report | Yes | Premium |
| GET | `/customer-analysis` | Customer analytics | Yes | Premium |
| POST | `/custom` | Generate custom reports | Yes | Premium |

## 🔐 Authentication & Authorization

### JWT Token Structure
```typescript
{
  id: string,        // User ID
  role: string,      // User role (USER, ADMIN)
  iat: number,       // Issued at
  exp: number        // Expiration time
}
```

### Role-Based Access Control
- **USER**: Standard user with company management access
- **ADMIN**: Administrative access with system-wide permissions

### Subscription Levels
- **Free**: 1 company, basic features, 100 transactions/month
- **Basic**: 3 companies, advanced features, 1000 transactions/month
- **Premium**: 10 companies, all features, unlimited transactions

## 🗄️ Database Schema

### Core Tables
- **users**: User accounts and authentication
- **companies**: Company information and settings
- **customers**: Customer database
- **products**: Product/service catalog
- **bills**: Invoices and billing records
- **payments**: Payment transactions
- **subscriptions**: User subscription details

### Key Relationships
- Users can have multiple companies (subscription-limited)
- Companies have customers, products, bills, and payments
- Bills reference customers and contain product line items
- Payments are linked to bills and customers

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (or Neon serverless)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shubhjn4357/vyapar-server.git
   cd vyapar-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/vyapar
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   
   # Social Auth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   
   # OTP Service (optional)
   SMS_API_KEY=your-sms-service-api-key
   
   # Server
   PORT=3000
   HOST=0.0.0.0
   ```

4. **Database Setup**
   ```bash
   # Generate and run migrations
   npm run db:generate
   npm run db:migrate
   
   # Optional: Seed database
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## 📝 API Documentation

### Request/Response Format

All API responses follow this structure:
```typescript
{
  status: 'success' | 'error',
  data?: any,
  message: string,
  errors?: string[]
}
```

### Authentication Header
```
Authorization: Bearer <jwt-token>
```

### Error Codes
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Missing or invalid token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Resource already exists
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## 📊 Performance & Monitoring

### Database Optimization
- Indexed queries for fast lookups
- Connection pooling for scalability
- Query optimization with Drizzle ORM

### Caching Strategy
- JWT token caching
- Frequently accessed data caching
- Redis integration ready

### Monitoring
- Request/response logging
- Error tracking and reporting
- Performance metrics collection

## 🔧 Development

### Code Style
- TypeScript strict mode enabled
- ESLint for code linting
- Prettier for code formatting

### Git Workflow
- Feature branches for new development
- Pull requests for code review
- Automated testing on CI/CD

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

## 🔄 Changelog

### v1.0.0
- Initial release with core features
- Authentication and authorization
- Company and customer management
- Basic billing functionality
- GST compliance features

---

**Built with ❤️ for small businesses in India**