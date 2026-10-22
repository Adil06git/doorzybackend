const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('✅ MongoDB connected and ready');
    console.log('\n🔑 Admin Login:');
    console.log(`   Email: admin@nearcart.com`);
    console.log(`   Password: admin123`);
  });
});
