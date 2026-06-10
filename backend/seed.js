const { initializeDatabase, getDatabase } = require('./src/database');

// Seed default leave types
const seedDefaultLeaveTypes = async () => {
  try {
    const db = await initializeDatabase();

    const leaveTypes = [
      { name: 'Annual Leave', annual_limit: 30, description: 'Regular paid leave' },
      { name: 'Sick Leave', annual_limit: 10, description: 'Leave for medical purposes' },
      { name: 'Maternity Leave', annual_limit: 90, description: 'Leave for maternity' },
      { name: 'Casual Leave', annual_limit: 5, description: 'Short-term casual leave' },
      { name: 'Bereavement Leave', annual_limit: 3, description: 'Leave for family loss' },
      { name: 'Parental Leave', annual_limit: 15, description: 'Leave for parenting' }
    ];

    for (const leaveType of leaveTypes) {
      const existing = await db.get('SELECT * FROM leave_types WHERE name = ?', [leaveType.name]);
      if (!existing) {
        await db.run(
          'INSERT INTO leave_types (name, annual_limit, description) VALUES (?, ?, ?)',
          [leaveType.name, leaveType.annual_limit, leaveType.description]
        );
        console.log(`Created leave type: ${leaveType.name}`);
      }
    }

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDefaultLeaveTypes();
