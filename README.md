# Eye Troops Optical Clinic Management System

A modern web-based management system designed for **Eye Troops Optical Clinic** to organize and simplify everyday clinic operations.

The system provides a centralized platform for managing patient records, optical prescriptions, orders, payments, sales, and clinic expenses.

## Features

- Patient management
- Patient visit and prescription records
- Optical order management
- Payment and balance tracking
- Order status tracking
- Sales and expense monitoring
- Today's clinic activity dashboard
- Pickup monitoring
- Search and filtering
- Responsive design for desktop and mobile
- Printable order receipts

## Tech Stack

- React
- JavaScript
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide React
- Supabase *(planned for backend integration)*

## Main Sections

The system currently includes six main sections:

1. **Login** – Secure access for authorized clinic personnel.
2. **Today** – Overview of daily collections, sales, expenses, unpaid balances, and pickups.
3. **Patients** – Manage patient information, prescriptions, visits, and history.
4. **New Visit** – Record patient visits, prescriptions, optical orders, and payments.
5. **Orders & Balances** – Track orders, payments, balances, and order statuses.
6. **Sales & Expenses** – Monitor monthly sales, expenses, and net income.

## Order Status

Orders follow a simple workflow:

```text
Ordered
   ↓
In Lab
   ↓
Ready for Pickup
   ↓
Claimed
