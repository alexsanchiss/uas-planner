# UAS Planner

A comprehensive flight plan management system for Unmanned Aerial Systems (UAS) with advanced bulk operations and unified API architecture.

## 🚀 Key Features

- **Unified API System**: Single endpoints for all operations (create, read, update, delete)
- **Bulk Operations**: Handle thousands of flight plans efficiently
- **CSV Management**: Automatic cleanup of associated CSV results
- **Transaction Safety**: Data consistency across all operations
- **Performance Optimized**: Automatic batching and chunking for large datasets

## 🏗️ Architecture

### **Unified API Endpoints**
- **`/api/flightPlans`**: All flight plan CRUD operations
- **`/api/csvResult`**: All CSV result operations
- **`/api/flightPlans/[id]/uplan`**: U-Plan generation (specialized)

### **Database Relationships**
- **Flight Plans** ↔ **CSV Results**: One-to-one relationship
- **Automatic Cleanup**: CSV results are removed when flight plans are deleted
- **Transaction Safety**: Operations are atomic and consistent

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- MySQL database
- Prisma CLI

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd uas-planner

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

### **Testing the System**
```bash
# Test CSV deletion functionality
node test-deletion.js --create-data  # Create test data
node test-deletion.js                # Run deletion tests
```

## 📚 API Documentation

Comprehensive API documentation is available in [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md), including:

- **Usage Examples** for all operations
- **Performance Optimizations** and best practices
- **Migration Guide** from old endpoints
- **Security Features** and validation rules

## 🔧 Performance Features

### **Bulk Operations**
- **Uploads**: 500 plans per batch, 5 concurrent operations
- **Updates**: 5000 IDs per request, automatic chunking
- **Downloads**: 1000 files per zip, multiple zip generation
- **Deletions**: Transaction-safe CSV cleanup

### **Memory Management**
- Automatic chunking for large operations
- Browser memory protection
- Efficient database queries

## 🛡️ Security & Validation

- **Input Sanitization**: Automatic type conversion and validation
- **Rate Limiting**: Maximum limits to prevent abuse
- **User Authentication**: Secure access control
- **Transaction Safety**: Rollback on failures

## 🧪 Testing

### **Smoke Tests**
```bash
# Test large batch operations
npm run test:smoke

# Test CSV cleanup
npm run test:csv-cleanup

# Test bulk operations
npm run test:bulk
```

### **Performance Tests**
- Upload 2500+ flight plans
- Bulk status updates on 1000+ plans
- Large CSV dataset downloads
- Concurrent operation testing

## 📊 Monitoring

### **API Metrics**
- Operation success/failure rates
- Response times for bulk operations
- Memory usage during large operations
- Transaction completion rates

### **Database Monitoring**
- Query performance metrics
- Transaction success rates
- Bulk operation completion times

## 🔄 Migration

### **From Old API**
The unified API maintains full backward compatibility:
- Individual operations work exactly as before
- Bulk operations provide enhanced performance
- No code changes required for basic functionality

### **To New Features**
- Enable bulk operations by passing arrays
- Use unified endpoints for all operations
- Leverage automatic CSV cleanup

## 🚀 Future Enhancements

- **Real-time Progress**: WebSocket updates for long operations
- **Advanced Batching**: Dynamic batch size optimization
- **Caching Layer**: Redis integration for performance
- **Async Processing**: Background job queues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: Check [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas

---

**Remember**: The unified API automatically detects operation type and applies the optimal processing method for maximum performance!