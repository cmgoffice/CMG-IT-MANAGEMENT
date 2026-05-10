import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import process from 'node:process';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const rootCollection = 'CMG-IT-MANAGEMENT';
const rootDoc = 'root';

const seedData = {
  users: [
    // Mock users have been removed per request
  ],
  logs: [
    { id: 'log-1', date: 'Oct 24, 2023', time: '14:23:01', initials: 'JS', name: 'Jane Smith', email: 'admin@itpro.com', action: 'Asset Registered', module: 'Inventory v2.4', ip: '192.168.1.142', ok: true },
    { id: 'log-2', date: 'Oct 24, 2023', time: '13:45:12', initials: 'RK', name: 'Robert King', email: 'robert@itpro.com', action: 'Repair Requested', module: 'Ticketing System', ip: '10.0.4.88', ok: true },
    { id: 'log-3', date: 'Oct 24, 2023', time: '13:12:44', initials: 'JS', name: 'Jane Smith', email: 'admin@itpro.com', action: 'Logged In', module: 'Core Auth', ip: '192.168.1.142', ok: true },
    { id: 'log-4', date: 'Oct 24, 2023', time: '12:58:30', initials: '??', name: 'Unknown Device', email: 'N/A', action: 'Failed Auth', module: 'Core Auth', ip: '45.23.112.9', ok: false },
    { id: 'log-5', date: 'Oct 24, 2023', time: '11:04:19', initials: 'MA', name: 'Marc Adams', email: 'marc@itpro.com', action: 'System Config Changed', module: 'Global Settings', ip: '172.16.0.45', ok: true },
  ],
  forms: [
    { id: 'fm-it-001', formCode: 'FM-IT-001', title: 'Repair Request', description: 'Submit requests for hardware repairs, screen replacements, or component failure troubleshooting.', icon: 'build', meta: 'Avg. Processing: 24h', variant: 'blue' },
    { id: 'fm-it-002', formCode: 'FM-IT-002', title: 'IT Appointment', description: 'Schedule a 1-on-1 session with our technical team for complex setup or consultation.', icon: 'calendar_month', meta: 'Flexible Scheduling', variant: 'violet' },
    { id: 'fm-it-003', formCode: 'FM-IT-003', title: 'Asset Request & Transfer', description: 'Request new equipment or transfer existing IT assets between departments.', icon: 'shopping_cart', meta: 'Inventory Update', variant: 'blue' },
    { id: 'fm-it-004', formCode: 'FM-IT-004', title: 'Asset Return', description: 'Formal process for returning equipment upon project completion or employee offboarding.', icon: 'assignment_return', meta: 'Inventory Update', variant: 'slate' },
    { id: 'fm-it-005', formCode: 'FM-IT-005', title: 'License Request', description: 'Request software keys, subscriptions, or specialized tools for design and development.', icon: 'vpn_key', meta: 'Compliance Checked', variant: 'blue' },
    { id: 'fm-it-006', formCode: 'FM-IT-006', title: 'User Registration', description: 'Grant new hires access to internal systems, databases, and secure server environments.', icon: 'person_add', meta: 'IAM Approved', variant: 'violet' },
    { id: 'fm-it-007', formCode: 'FM-IT-007', title: 'Remote Support & Software', description: 'Request remote desktop assistance or enterprise software deployment to your machine.', icon: 'settings_remote', meta: 'Response Time ~15 Minutes', variant: 'blue' },
  ],
  assets: [
    { id: 'IT-LAP-001', name: 'MacBook Pro 16"', spec: 'M3 Max', serial: 'C02FX123GH67', user: 'Sarah Chen', userAvatar: null, status: 'Active', category: 'Laptop', history: [{ date: '2026-05-07 09:10', action: 'Updated', detail: 'RAM and status updated to Active.' }] },
    { id: 'IT-MON-042', name: 'Dell UltraSharp 32"', spec: '4K HDR', serial: 'CN-0XJ12-744', user: 'Marcus V.', userAvatar: null, status: 'Repair', category: 'Monitor', history: [{ date: '2026-05-06 15:22', action: 'Repair', detail: 'Display flickering issue reported.' }] },
    { id: 'IT-PRN-009', name: 'HP LaserJet Enterprise', spec: 'Floor 3', serial: 'JPB2G19904', user: null, userAvatar: null, status: 'Retired', category: 'Printer', history: [{ date: '2026-03-12 14:00', action: 'Retired', detail: 'Printer reached end-of-life.' }] },
    { id: 'IT-LAP-024', name: 'ThinkPad X1 Carbon', spec: 'Gen 11', serial: 'PF-2A384XJ', user: 'Elena Rodriguez', userAvatar: null, status: 'Active', category: 'Laptop', history: [{ date: '2026-05-03 13:19', action: 'Assigned', detail: 'Assigned to Elena Rodriguez.' }] },
    { id: 'IT-PHN-012', name: 'iPhone 15 Pro', spec: '256GB', serial: 'DNQXC2K3MH', user: 'David Miller', userAvatar: null, status: 'Active', category: 'Phone', history: [{ date: '2026-02-21 16:40', action: 'Assigned', detail: 'Assigned to David Miller.' }] },
  ],
  equipmentEvents: [
    { id: 'ev-1', icon: 'task_alt', iconBg: 'bg-[#c7e7ff]', iconColor: 'text-[#155590]', fill: true, title: 'Repair completed', date: 'Oct 24, 2023 • 14:20', content: 'Logic board components stabilized. Fan assembly cleaned and heat sink paste reapplied. Full diagnostic pass: Green.', meta: [{ icon: 'person', text: 'Technician: Mike R.' }, { icon: 'receipt', text: 'Case #88219' }] },
    { id: 'ev-2', icon: 'warning', iconBg: 'bg-[#fa746f]/20', iconColor: 'text-[#a83836]', fill: false, title: 'Repair requested', date: 'Oct 21, 2023 • 09:15', content: 'User reported thermal throttling and excessive fan noise during rendering tasks. Device flagged for urgent inspection.', meta: [] },
    { id: 'ev-3', icon: 'person_add', iconBg: 'bg-[#27619d]', iconColor: 'text-[#f8f8ff]', fill: false, title: 'Assigned to Sarah Jenkins', date: 'May 12, 2023 • 10:00', content: 'Asset moved from IT Storage to Design Ops. Onboarding kit included. User acknowledgment signed digitally.', meta: [] },
  ],
};

const batch = writeBatch(db);
for (const [menu, rows] of Object.entries(seedData)) {
  for (const row of rows) {
    const ref = doc(db, rootCollection, rootDoc, menu, row.id);
    const payload = { ...row };
    delete payload.id;
    batch.set(ref, payload, { merge: true });
  }
}

await batch.commit();
console.log('Seed completed: CMG-IT-MANAGEMENT/root/<menu>');
