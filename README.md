# 60-40 Calculator

The 60-40 Calculator is a Docker Compose–based web application built with Flask. It provides a calendar interface where users can mark days with various statuses and view monthly and yearly statistics. The project supports user registration and login (using email addresses), password change functionality, and an admin dashboard that displays all users’ statistics and allows password resets as well as toggling a global lock to restrict modifications for past months.

## Table of Contents

- Features
- Directory Structure
- Data Files
- Installation & Setup
- Usage
  - User Functionality
  - Admin Functionality
- Configuration
- Starting & Stopping the Service
- Notes

## Features

- **Calendar Interface:**  
  Users can click on days in a calendar to cycle through statuses:
  - empty
  - office
  - home
  - day off (this status is excluded from statistics)

- **Statistics:**  
  The application computes monthly and yearly statistics based on work days (only office and home statuses count).  
  The background color of the statistics display changes:
  - Light green if the office percentage is 60% or higher.
  - Light coral if it is below 60%.

- **User Management:**  
  - Registration & Login: Users register and log in using their email address and password.
  - Password Change: After logging in, users can change their own password.
  - Password Hashing: All passwords are stored securely using hashing (via Werkzeug).

- **Admin Dashboard:**  
  - The admin (email: admin@example.com) does NOT have a personal calendar. Instead, upon login, the admin sees a button to access the Admin Dashboard.
  - The Admin Dashboard displays each non-admin user’s monthly statistics for all 12 months of a selected year as well as their overall yearly statistics.
  - For each user, there is a button to reset their password to apple123.
  - The admin dashboard includes a Year Selector so that the admin can view statistics for any year.
  - The admin can also toggle a global lock that restricts modifications on days outside of the current month. When enabled, users can only modify the current month’s calendar.

## Directory Structure

.
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── app.py
├── README.txt
├── data
│   ├── users.json       # Stores registered users and their hashed passwords
│   ├── day_states.json  # Stores calendar states for each user (date → status)
│   └── config.json      # Stores global configuration (e.g., "lock_past_months")
├── templates
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── change_password.html
│   └── admin_stats.html
└── static
    ├── calendar.js
    └── styles.css

## Data Files

- data/users.json:  
  Contains a JSON object mapping user emails to their password hashes.
  Example:
  {
      "admin@example.com": "<hashed_admin_password>",
      "user1@example.com": "<hashed_password>",
      "user2@example.com": "<hashed_password>"
  }

- data/day_states.json:  
  Contains calendar data for each user. Each key is a user email, and its value is an object mapping dates (in YYYY-MM-DD format) to one of the statuses (empty, office, home, or day_off).

- data/config.json:  
  Contains global configuration settings. For example:
  {
      "lock_past_months": true
  }

## Installation & Setup

1. Clone the repository:
   git clone <repository_url>
   cd <repository_directory>

2. Create the data directory (if it does not exist):
   mkdir data

3. Ensure you have Docker and Docker Compose installed.

4. Build and start the service using Docker Compose:
   docker-compose up --build

## Usage

### User Functionality

- Registration:  
  Users can register by providing an email and password on the Register page.
  
- Login:  
  Use the registered email and password to log in on the Login page.

- Calendar Interaction:  
  After logging in, users see a calendar for the current month. Clicking on a day cycles its status in the following order:
  empty → office → home → day_off → empty
  Note: If the global lock is enabled (set by the admin), modifications are allowed only for the current month. If a user attempts to modify a day outside of the current month, an alert is shown.

- Statistics:  
  The calendar page displays monthly and yearly statistics. The background color of the statistics changes based on the office percentage:
  - Light green: Office percentage is 60% or higher.
  - Light coral: Office percentage is below 60%.

- Password Change:  
  Users can change their password via the Change Password page (accessible from the navigation bar). The user must provide their current password along with a new password and confirmation.

### Admin Functionality

- Admin Account:  
  The admin account is automatically created if it does not exist.
  Email: admin@example.com
  Initial Password: admin123

- Admin Dashboard:  
  After logging in as admin, the main page shows a button to access the Admin Dashboard.
  
- Viewing Statistics:  
  The Admin Dashboard shows for each non-admin user:
  - A table with statistics for each month (1–12) for a selected year.
  - An overall yearly statistics row.
  - The table rows are color-coded (light green for office ≥ 60%, light coral otherwise).
  
- Year Selector:  
  An input field allows the admin to select which year’s statistics to view.

- Password Reset:  
  Next to each user’s email on the Admin Dashboard is a button labeled “Reset Password to apple123.” Clicking this will reset the user’s password to apple123 (hashed and stored).

- Global Lock Toggle:  
  The Admin Dashboard includes a button to toggle the global lock (lock_past_months). When enabled, users are restricted to modifying only the current month’s calendar. When disabled, modifications can be made to any month.

## Configuration

- The global configuration is stored in data/config.json.
  - lock_past_months: A boolean value (true or false).
    - When true: Users can only modify the calendar for the current month.
    - When false: Users can modify any month.

## Starting & Stopping the Service

- To Start the Service:
  docker-compose up --build
  This builds the Docker image (if necessary) and starts the container on port 9090.

- To Stop the Service:
  Press Ctrl+C in the terminal where Docker Compose is running, then execute:
  docker-compose down
  This stops and removes the containers.

## Notes

- Password Hashing:  
  All user passwords are stored securely using hashing (via Werkzeug's generate_password_hash and check_password_hash).

- Data Persistence:  
  The application uses JSON files located in the data folder to persist user data, calendar states, and configuration. These files are mapped as a volume in the Docker Compose configuration so that data is preserved across container restarts.

- Modifying Past Data:  
  The global lock (controlled by the admin) prevents users from modifying calendar data for months other than the current one. This is useful for preserving historical data once the year is over, while still allowing modifications when approved by the admin.

- Default Admin Account:  
  On first run, if no admin account exists, one is created automatically with:
      Email: admin@example.com
      Password: admin123

Happy coding!
