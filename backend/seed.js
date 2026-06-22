const { initializeDatabase, getDatabase } = require('./src/database');

// Seed default leave types
const seedDefaultLeaveTypes = async () => {
  try {
    const db = await initializeDatabase();

    const leaveTypes = [
      { name: 'Annual Leave', annual_limit: 30, description: 'Regular paid leave', applicable_gender: 'All' },
      { name: 'Sick Leave', annual_limit: 10, description: 'Leave for medical purposes', applicable_gender: 'All' },
      { name: 'Maternity Leave', annual_limit: 90, description: 'Leave for maternity', applicable_gender: 'Female' },
      { name: 'Paternity Leave', annual_limit: 14, description: 'Leave for paternity', applicable_gender: 'Male' },
      { name: 'Casual Leave', annual_limit: 5, description: 'Short-term casual leave', applicable_gender: 'All' },
      { name: 'Bereavement Leave', annual_limit: 3, description: 'Leave for family loss', applicable_gender: 'All' },
      { name: 'Parental Leave', annual_limit: 15, description: 'Leave for parenting', applicable_gender: 'All' }
    ];

    for (const leaveType of leaveTypes) {
      const existing = await db.get('SELECT * FROM leave_types WHERE name = ?', [leaveType.name]);
      if (!existing) {
        await db.run(
          'INSERT INTO leave_types (name, annual_limit, description, applicable_gender) VALUES (?, ?, ?, ?)',
          [leaveType.name, leaveType.annual_limit, leaveType.description, leaveType.applicable_gender]
        );
        console.log(`Created leave type: ${leaveType.name}`);
      } else if (!existing.applicable_gender) {
        await db.run(
          'UPDATE leave_types SET applicable_gender = ? WHERE id = ?',
          [leaveType.applicable_gender, existing.id]
        );
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
