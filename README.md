# 📄 Document Manager

A modern, responsive web application for managing quotations, invoices, and delivery notes. Built with React, TypeScript, and Firebase, featuring a beautiful UI with Tailwind CSS.

## ✨ Features

### 📋 Document Management
- **Create & Edit**: Quotations, invoices, and delivery notes
- **Auto-numbering**: Automatic document number generation
- **Status Tracking**: Draft, sent, paid, cancelled statuses
- **Duplicate Documents**: Easy document duplication
- **Print/PDF Export**: Professional document printing

### 👥 Client Management
- **Client Database**: Store and manage client information
- **Auto-complete**: Quick client selection from existing database
- **Client Details**: Name, email, phone, address, TRN storage

### 📊 Dashboard & Analytics
- **Overview Stats**: Document counts and revenue tracking
- **Advanced Search**: Search by client name or document number
- **Multi-filter System**: Filter by type, status, and date range
- **Bulk Operations**: Select and delete multiple documents

### 📱 Mobile Optimized
- **Responsive Design**: Works perfectly on all device sizes
- **Touch-Friendly**: Optimized for mobile interactions
- **Horizontal Scrolling**: Tables adapt to small screens

### 📈 Import/Export
- **Excel Import**: Bulk import documents from Excel files
- **Data Export**: Export documents for external use

### ⚙️ Company Settings
- **Branding**: Company logo, name, and address
- **Tax Configuration**: Customizable tax rates
- **Terms & Conditions**: Default terms for documents
- **Logo Upload**: Upload company logo files or use URLs

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/document-manager.git
   cd document-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Copy your Firebase configuration

4. **Configure Firebase**
   - Update `src/lib/firebase.ts` with your Firebase configuration:
   ```typescript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

5. **Set up Firestore Security Rules**
   - Copy the rules from `firestore.rules` to your Firebase Console
   - Deploy the security rules

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Create an account and start using the application

## 🛠️ Built With

- **Frontend Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Build Tool**: Vite
- **File Processing**: XLSX for Excel import
- **Linting**: ESLint with TypeScript support

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── AuthWrapper.tsx  # Authentication wrapper
│   ├── Dashboard.tsx    # Main dashboard
│   ├── DocumentForm.tsx # Document creation/editing
│   ├── DocumentView.tsx # Document viewing/printing
│   ├── ExcelImport.tsx  # Excel import functionality
│   ├── Login.tsx        # Authentication forms
│   └── Settings.tsx     # Company settings
├── lib/                 # Utility libraries
│   ├── firebase.ts      # Firebase configuration
│   ├── firebaseHelpers.ts # Database operations
│   └── documentHelpers.ts # Document utilities
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## 📱 Mobile Features

The application is fully responsive and includes:
- Touch-optimized interface
- Horizontal scrolling tables
- Collapsible navigation
- Mobile-friendly forms
- Responsive grid layouts

## 🔐 Security

- Firebase Authentication for user management
- Firestore security rules for data protection
- User-specific data isolation
- Secure client-side validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/document-manager/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce any bugs

## 🎯 Roadmap

- [ ] Email integration for sending documents
- [ ] Advanced reporting and analytics
- [ ] Multi-currency support
- [ ] Document templates
- [ ] API integration capabilities
- [ ] Offline mode support

---

Made with ❤️ using React, TypeScript, and Firebase
