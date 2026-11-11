# Who Can Do What in StoreForge

This guide explains the different kinds of users in StoreForge, what each one can do, and how they get in.

---

## The short version

There are **4 kinds of people**:

| Who | What they are | In one line |
|---|---|---|
| **Platform Admin** | Works for StoreForge itself | Creates companies. Never sees a company's shop data. |
| **Owner** | The boss of one company | Full control, and the only one who can add team members. |
| **Manager** | Trusted helper of the Owner | Runs the shop day to day, can delete things and change store settings. |
| **Staff** | Everyday worker | Can add and edit products and customers, but cannot delete. |
| **Shopper** (visitor) | Anyone on the internet | Can only look at the public storefront. No login needed. |

> **Note:** In the database, the Manager role is stored under the name `admin`. It is shown as **Manager** on screen so nobody mixes it up with the StoreForge Platform Admin.

---

## How people get an account

There is **no public sign-up**. Accounts are always created for you:

1. A **Platform Admin** creates a company. This also creates the company's first store and the **Owner's** login.
2. The **Owner** creates accounts for their own **Managers** and **Staff** (under *Team members*).
3. Forgot your password? Ask your company Owner to reset it. Owners change their own password under *Settings*; the StoreForge team cannot reset it for them.

---

## What each role can do

✅ = allowed  ❌ = not allowed

### Shop work

| Action | Owner | Manager | Staff |
|---|:---:|:---:|:---:|
| See the dashboard (Overview, Analytics) | ✅ | ✅ | ✅ |
| Add and edit products, categories, collections | ✅ | ✅ | ✅ |
| Adjust stock (Inventory) | ✅ | ✅ | ✅ |
| Add and edit customers | ✅ | ✅ | ✅ |
| **Delete** products, categories, collections | ✅ | ✅ | ❌ |
| **Delete** customers | ✅ | ✅ | ❌ |

### Running the company

| Action | Owner | Manager | Staff |
|---|:---:|:---:|:---:|
| Change store settings (name, currency, etc.) | ✅ | ✅ | ❌ (view only) |
| Change company details | ✅ | ✅ | ❌ |
| See the **Team members** page | ✅ | ❌ | ❌ |
| Add, change or disable team members | ✅ | ❌ | ❌ |
| Delete the store or the company | ✅ | ❌ | ❌ |

Every user can also change their **own** profile and password under *Settings*.

### Platform Admin (StoreForge staff)

| Action | Platform Admin |
|---|:---:|
| Create a company with its first store and Owner | ✅ |
| See the list of companies and their details | ✅ |
| See each company's Owner name and email | ✅ |
| See a company's products, customers or orders | ❌ (by design) |

The Platform Admin area only deals with companies. Shop data stays private to each company.

---

## How to access each area

| Who | Where they go | What they see in the menu |
|---|---|---|
| **Platform Admin** | `/admin` | Overview, Companies, Create company |
| **Owner** | `/dashboard` | Overview, Products, Categories, Collections, Inventory, Customers, Analytics, **Team members**, Settings |
| **Manager** | `/dashboard` | Same as Owner but **without** Team members |
| **Staff** | `/dashboard` | Same as Manager (delete and settings buttons are hidden or locked) |
| **Shopper** | The public store page (`/s/<store-name>`) | Products and collections. No login. |

**To sign in:** go to `/login`, enter your email and password. You are sent to the right place automatically:

- Platform Admins land in `/admin`.
- Everyone else lands in `/dashboard`.

> The landing page and storefronts no longer show a login button. Go to `/login` directly.

---

## Good to know

- **One company at a time.** You only ever see your own company's data. Other companies' data is blocked by the database itself, not just by the screen.
- **Several companies?** If your account belongs to more than one company, use the switcher in the dashboard to pick which one you are working in.
- **Store address.** On a store's own address (`<store>.<domain>`), you can only sign in to that store's workspace. Being a member of another company does not get you in.
- **Hidden is not the only protection.** If a button is hidden for your role, the server and the database also refuse the action. Typing a secret address will not help.
- **Disabled accounts.** If an Owner disables a team member, that person keeps their record but loses all access.
- **Suspended companies.** If a company is suspended, none of its people can get in. They see a "no workspace" page and should contact their Owner or StoreForge.
- **"No workspace" page.** You see this when your account is not linked to an active company. Contact your Owner or StoreForge admin.

---

## Quick cheat sheet

- **Need a new company?** Ask a Platform Admin.
- **Need a new team member or a password reset?** Ask your Owner.
- **Can't delete something?** You are probably Staff. Ask a Manager or Owner.
- **Can't change store settings?** You are probably Staff. Ask a Manager or Owner.
- **Can't see Team members?** Only Owners can.

---

