SaaS Software Specification
PART 1 — Platform Structure, Authentication & Dashboard
Platform UI Layout
When the website opens, users should see a modern and professional UI.
Header Layout
Left Side
Tool logo (Use logo from /public/LeadGenor.webp in header and favicon.)
Header Navigation
 Header must contain links to major pages of the tool.
Right Side
Login button
Get Started button
Authentication
Login
If a user already has an account, they can log in.
Get Started / Signup
If the user does not have an account, they can sign up.
After signup, the user should land inside their personal account dashboard.

Dashboard
After login the user should see a dashboard with modern statistic cards.
Each card should:
Display label outside
Display value inside
Auto update whenever data changes
Be clickable
Have hover animation (slightly lift upward)
Cards should also open the same sections as sidebar links.

Dashboard Cards
Revenue & Profit Cards
Total Sale
Last 30 Days Sales
Total Profit
Last 30 Days Profit
Operational Cards
Total Vendors
Deal Done Vendors
Pending Deals
Total Clients
Completed Orders
Pending Orders
Whenever user adds data anywhere in the system, these cards automatically update.
Have hover animation (slightly raised on hover)

Sidebar Navigation
Vendors (Dropdown)
Options:
Add New Vendor
Total Vendors
Deal Done Vendors
Pending Deals
Dropdown only expands when clicked.

Clients (Dropdown)
Options:
Add New Client
Total Clients

Orders (Dropdown)
Options:
Add New Order
Total Orders
Completed Orders
Pending Orders

PART 2 — Vendor Management System
Add New Vendor
User can add a guest post vendor with the following fields.
Company Name
Site URL
Niche / Category
When user clicks niche field:
A list of all blog niches appears
Minimum selection: 1
Maximum selection: 5
Include option: General

Traffic
User can manually enter any number starting from 0 or above.

Traffic Country
When clicked:
Show list of all countries
Minimum selection: 1
Maximum selection: 3

Language
Show list of all world languages
Selection rules:
Minimum: 1
Maximum: 1

User enters manually:
DR (Domain Rating) → 0-100
Moz DA → 0-100
AS (Authority Score) → 0-100
Referring Domains → manual input
Backlinks → manual input
Trust Flow → manual input

TAT (Turnaround Time)
The TAT field must work in the following way:
First, the user selects the time unit:
Hours
Days
After selecting the unit, the user enters the numeric value.
The system should automatically display the value in short format using a suffix:
Examples:
If the user selects Days and enters 2, the field should display:
 2D
 (D represents Days)
If the user selects Hours and enters 24, the field should display:
 24H
 (H represents Hours)
The selected unit should always appear together with the numeric value inside the field.


Currency System
The system must support global currencies.
Currency Selection
When creating or editing a vendor record, the user must select one currency from a global currency list.
Examples of currencies:
USD ($)
PKR (Rs)
EUR (€)
GBP (£)
and other international currencies.
Currency Behavior
Once the user selects a currency for a vendor, the same currency must be used and displayed everywhere related to that vendor.
This includes:
Vendor price fields
Order prices
Client order view
Invoice display
Revenue calculations
Profit calculations
Vendor detail pages
Order summaries
Currency Display
The currency symbol must always appear with the price value.
Examples:
If the vendor currency is USD, prices should appear like:
$4
$10
$25
If the vendor currency is PKR, prices should appear like:
Rs 40
Rs 100
Rs 500
If the vendor currency is EUR, prices should appear like:
€5
€15
€50
Important Rule
The system must always display the currency selected for that specific vendor across the entire interface.
Different vendors can use different currencies, and each vendor’s data must display using its own selected currency.


Pricing Fields
Vendor Costs:
Guest Post Cost
Niche Edit Cost
Reseller Prices:
Guest Post Price
Niche Edit Price

Payment Terms
Options:
Advance
After Live Link
If After Live Link is selected, show additional options:
In 12 Hours
In 24 Hours
In 36 Hours
In 48 Hours
In 3 Days
In 4 Days
In 5 Days
In 6 Days
In 7 Days
In 14 Days
In 30 Days
The selected time should display together with "After Live Link".

Payment Methods
User can select from list of digital banks:
Examples:
Payoneer
PayPal
Wise
Other digital payment systems
Selection rules:
Minimum: 1
Maximum: 5

Contact Information
Fields:
Contact Email
Contact Page URL

Deal Status
Options:
Deal Done
Pending

Additional Fields
Date
Notes field (small text box)

Save Vendor
After clicking Save:
The vendor must automatically appear in:
Total Vendors
Deal Done Vendors (if selected)
Pending Deals (if selected)
All vendor stats must be saved.

Duplicate URL Detection
If the same Site URL already exists in vendor database:
Show popup alert:
"This site already exists in your total vendors list. Do you want to add it again?"
Options:
Cancel
Add

Vendor Import
Inside the Add New Vendor page, the user should have an Import option.
The user can upload:
CSV files
Google Sheets (via link or integration)
The system must automatically map all columns to the correct fields, such as:
DR
DA
Traffic
Country
Prices
All other available columns
Each value must automatically be assigned to its correct field in the vendor database.
This import feature must also be available in:
Total Vendors section (above the table in the control/filter row)
Total Clients section (above the table in the control/filter row)
Duplicate Handling
If any imported vendor already exists (based on URL), the system must show a duplicate confirmation popup, asking the user whether to:
Skip
Add anyway 


Total Vendors Section
Displays a table list of all vendors.
Each row must show:
Site URL
Niche
DR
Traffic
Country
Language
Price (Reseller Guest Post Price)
Row actions:
View
Edit
Delete

View Vendor
User can view all vendor stats.
Editing is not allowed in view mode.

Edit Vendor
User can edit all fields exactly like Add New Vendor form.

Delete Vendor
User can delete vendor.
After deletion:
Show Undo option for 5 seconds
If undo not clicked:
Vendor moves to Trash section.

Vendor Trash System
Deleted vendors remain in trash for 28 days.
User can:
Restore vendor
Permanently delete vendor
Actions available:
Delete one by one
Select All delete
If no action taken → vendor auto deletes after 28 days.

Table Header Row (Above Vendor List)
Above table there should be a control row.
Search URL Field
A search input must be available:
Label: Search URL
User can type or paste a vendor/client URL
System should instantly filter and show matching results
This search must work only on the URL field.


Filter System
User must be able to filter vendors using all available vendor fields.
Filter ranges include:
DR (from-to)
Traffic (from-to)
Referring Domains (from-to)
Guest Post Price (from-to)
Niche Edit Price (from-to)
URL
Date
All filters must support:
Include
Exclude
Filtered results should display filtered vendor count instead of total count.
After filters are applied, a Clear Filter option should be available for the user.
Export Vendors
User can export vendors in formats:
CSV
Excel
PDF
User can:
Select individual vendors
Select All vendors
Then download selected records.

Vendor Count Display
Example:
1-20 out of 200
Shows how many vendors are displayed.

The count display (e.g. “1–20 out of 200”) must be shown above the filter and export row.
It should also show the number of selected items in real time, such as “12 selected”, “20 selected”, updating whenever the user selects or deselects checkboxes.
Deal Done Vendors Section
Displays vendors where:
Deal Status = Deal Done
Table columns remain same:
URL
Niche
DR
Traffic
Country
Language
Price (Guest Post reseller price)
View
Edit
Delete
Features same as total vendors:
Filters
Export
Quantity indicator

Pending Deals Section
Shows vendors where:
Deal Status = Pending
All features same as Deal Done Vendors section.

Bulk Price Update (Deal Done Vendors)
Inside Deal Done Vendors section add bulk pricing option.
User can increase or decrease all reseller prices with one action.
Example:
User enters 10%
Tool increases reseller price of all deal done vendors by 10%.
Options must apply to both:
Guest Post Price
Niche Edit Price
User can increase or decrease prices in bulk.

Vendor Order Indicators
If orders exist for a vendor:
Show small order count indicator near vendor URL.
Example:
Vendor has 3 completed orders
Display number 3 near the URL.
Rules:
If orders < 10 → show red
If orders ≥ 10 → show green
Vendors with more orders should appear higher in vendor list.

PART 3 — Clients, Orders, Invoice, Revenue & Profit
Add New Client
Fields:
Company Name
Client Name
Site URL
Niche, show all blog niches (minimum 1, maximum 5 allow to select)
Country; show all countries list (minimum 1, maximum 3 allow to select)
Language: show all languages list (1 allow to select)
Traffic
DR
DA
AS
Referring Domains
Backlinks
Email
WhatsApp
After saving:
Client appears in Total Clients list.

Total Clients Section
Table columns:
Site URL
Niche
DR
Traffic
Country
Language
View
Edit
Delete
Controls:
Quantity indicator
Import option
Filters
Export option not included here.

Trash Dropdown
Sidebar should include Trash dropdown:
Vendor Trash
Client Trash
Orders Trash
User can set trash retention period:
Selectable range:
7 days → 28 days
Trash actions:
Restore
Permanently delete
Select All
Delete / restore one by one

Orders System
Create New Order
Fields:
Client Site URL
Vendor Site URL
Link Type options:
Guest Post
Link Insertion / Niche Edit

Price Detection
When user selects link type:
Tool automatically detects vendor reseller price and fills the price field.
Currency symbol must appear.

Article Writing
Options:
Yes
No
If Yes:
User enters Article Writing Fee (USD).

Total Payment
Tool automatically calculates:
Price + Article Writing Fee

Payment Terms
Options:
Advance
After Live Link

Delivery Time
Dropdown options:
1 day → 30 days

Order Status
Options:
Completed
Pending

Client Email
Tool should automatically fetch client email from client database if not available, user have to acces put manually.

Order Date
User can set order date manually.

Save Order
Once order is saved:
Order appears inside:
Total Orders
Completed Orders (if selected)
Pending Orders (if selected)

Invoice System
After saving order:
User should see Send Invoice option.
When clicked:
Tool automatically sends email to client email.
Invoice email must contain:
Client Site URL
Vendor Site URL
Link Type
Price (reseller Price according to selected link type)
Article Writing Fee (if included)
Total Payment
Payment Method (user manually enters bank ID or account number)
Delivery time
Order date
User should also have option to download invoice.

Order Actions
Each order should support:
View
Edit
Delete

Revenue Sections (Sidebar)
Sections include:
Total Sales
Last Month Revenue
Total Profit
Last Month Profit

Revenue Calculation Rules
Only Completed Orders count.
If order currency is not USD:
Tool automatically converts it to USD using exchange rate.
Revenue sections should display USD values only.
Orders in these sections must be view-only (not editable).
Clicking View should take user to that order inside Orders section.

Profit Calculation
Profit = Reseller Price − Vendor Cost
Tool calculates profit for every completed order.
Profit values are added to Total Profit.

Last 30 Days Data
Tool must automatically calculate:
Last 30 Days Revenue
Last 30 Days Profit
This updates dynamically.

Client Order Indicators
Near Client URL field, show number of completed orders for that client.
Example:
Client has 5 completed orders
Show 5 indicator near URL.
Clients with more orders should appear higher in client list.
UI Theme Requirement (Important)

The SaaS must follow a mixed theme layout:

1. Sidebar + Header
The sidebar and header must be DARK themed
They should have a modern dark UI (professional SaaS style)
Text and icons should be clearly visible on dark background
2. Main Content Area (Body)
The main dashboard/content area must be LIGHT themed
All tables, forms, cards, and pages should use a clean light background
3. Overall Layout Behavior
Dark sidebar + dark header should remain consistent on all pages
Light content area should change dynamically based on selected module (vendors, clients, orders, etc.)
Theme must look modern, clean, and SaaS-style (like professional CRM tools)


Technologies for Guest Post Management System
1. Frontend (UI Layer)
Next.js (React Framework)
TypeScript
Tailwind CSS
ShadCN UI (or Radix UI components)

👉 Use for:

Dashboard
Vendor/Client tables
Forms (Add/Edit)
Filters, search, pagination UI
2. Backend (Server Logic)
Node.js
NestJS (preferred) OR Express.js
TypeScript

👉 Use for:

Vendor/Client/Order APIs
Business logic
Filtering, sorting, calculations
Authentication handling
3. Database
PostgreSQL (Primary Database)
Prisma ORM

👉 Store:

Vendors
Clients
Orders
Trash data
Revenue & profit logs
4. Authentication
NextAuth.js (Auth.js)

👉 Features:

Login / Signup
Session management
Secure user access
5. File Handling (Import/Export)
PapaParse (CSV import)
Google Sheets API (spreadsheet import)
xlsx library (Excel export)
jsPDF (PDF export)
6. State Management
Zustand OR Redux Toolkit

👉 Use for:

Dashboard state
Filters
Selected rows
UI interactions
7. Backend Utilities
Zod (validation)
bcrypt (security if needed)
dotenv (environment variables)
8. Performance & Scaling
Redis (optional but recommended)
caching
pagination optimization
bulk operations support
9. Deployment Stack
Vercel (Frontend)
AWS / DigitalOcean (Backend)
Supabase / Neon (PostgreSQL hosting option)
10. UI Enhancements
Recharts (graphs for revenue/profit dashboard)
Lucide Icons (icons system)
🔥 Final Instruction for Cursor
Build system in modular architecture
Separate modules:
Vendors Module
Clients Module
Orders Module
Trash Module
Revenue Module
Everything must be database-driven (no hardcoded logic)