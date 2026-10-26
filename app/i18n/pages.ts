/**
 * i18n texts for the shell (header/footer), boundaries, route titles, Plan Activation,
 * auth pages and profile/settings. Kept in its own file and spread into `translations`
 * (see translations.ts) so these screens do not collide with the large shared dictionary.
 * Default language: English (see `defaultLanguage` in translations.ts).
 */

export interface PageTranslations {
  /** Static metadata titles. Server layouts use these in the default language. */
  titles: {
    appName: string
    siteDescription: string
    launch: string
    login: string
    forgotPassword: string
    resetPassword: string
    verifyEmail: string
    contact: string
    howItWorks: string
    privacy: string
    planDefinition: string
    planAuthorization: string
    planActivation: string
    profile: string
    settings: string
  }
  boundary: {
    errorTitle: string
    errorBody: string
    retry: string
    notFoundTitle: string
    notFoundBody: string
    backHome: string
    loading: string
    globalErrorTitle: string
    globalErrorBody: string
  }
  shell: {
    mainNav: string
    openMenu: string
    closeMenu: string
    userMenu: string
    brandHome: string
    profileAlt: string
    verifyingAuth: string
    redirectingToLogin: string
    connect: string
    apps: string
    information: string
    rightsReserved: string
  }
  activation: {
    readyNow: string
    readyNowHint: string
    upcoming: string
    upcomingHint: string
    upcomingEmpty: string
    emptyTitle: string
    emptyBody: string
    emptyCta: string
    loadErrorTitle: string
    loadingPlans: string
    windowClosesIn: string
    windowOpensIn: string
    activationOpen: string
    termsRegion: string
    colActivation: string
    colActivatedAt: string
    historyRegion: string
    statusActivable: string
    statusActivating: string
    statusTakeoffCleared: string
    statusDenied: string
    statusWindowPassed: string
    statusNotActivable: string
  }
  authForm: {
    tabsLabel: string
    firstName: string
    lastName: string
    phone: string
    optional: string
    verificationCode: string
    submitting: string
    signingIn: string
    creatingAccount: string
    showPolicy: string
  }
  account: {
    profileTitle: string
    profileSubtitle: string
    firstName: string
    lastName: string
    phone: string
    firstNamePlaceholder: string
    lastNamePlaceholder: string
    phonePlaceholder: string
    save: string
    saving: string
    saved: string
    saveFailed: string
    loadFailed: string
    activeAccount: string
    email: string
    notSet: string
    accountId: string
    userFallback: string
    settingsTitle: string
    settingsSubtitle: string
    appearance: string
    appearanceHint: string
    themeDark: string
    themeDarkHint: string
    themeLight: string
    themeLightHint: string
    languageHint: string
    quickLinks: string
    contactHint: string
    howItWorksHint: string
    privacyHint: string
    selected: string
    notificationsSoon: string
    notificationsSoonDetail: string
  }
}

export const pageEn: PageTranslations = {
  titles: {
    appName: 'UPPS',
    siteDescription: 'UPPS: U-plan and flight plan preparation service for drone operators.',
    launch: 'Home',
    login: 'Log in',
    forgotPassword: 'Forgot password',
    resetPassword: 'Reset password',
    verifyEmail: 'Verify email',
    contact: 'Contact us',
    howItWorks: 'How it works',
    privacy: 'Privacy policy',
    planDefinition: 'Plan Definition',
    planAuthorization: 'Plan Authorization',
    planActivation: 'Plan Activation',
    profile: 'Profile',
    settings: 'Settings',
  },
  boundary: {
    errorTitle: 'Something went wrong',
    errorBody: 'An unexpected error occurred. You can try again.',
    retry: 'Try again',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The address does not exist or has moved.',
    backHome: 'Back to home',
    loading: 'Loading...',
    globalErrorTitle: 'Something went wrong',
    globalErrorBody: 'The application hit a serious error. You can try again.',
  },
  shell: {
    mainNav: 'Main navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    userMenu: 'Account menu',
    brandHome: 'PAUTHFLY home',
    profileAlt: 'User profile',
    verifyingAuth: 'Verifying authentication...',
    redirectingToLogin: 'Redirecting to sign in...',
    connect: 'Connect',
    apps: 'Apps',
    information: 'Information',
    rightsReserved: 'All rights reserved.',
  },
  activation: {
    readyNow: 'Ready now',
    readyNowHint: 'Flights inside their activation window (1 minute before or after the scheduled time).',
    upcoming: 'Upcoming',
    upcomingHint: 'Authorized flights scheduled soon. Activation opens 1 minute before the scheduled time.',
    upcomingEmpty: 'No authorized flights scheduled in the next 24 hours.',
    emptyTitle: 'No authorized plans scheduled',
    emptyBody: 'Approved plans with a scheduled time show up here. Authorize a plan to get it ready for activation.',
    emptyCta: 'Go to Plan Authorization',
    loadErrorTitle: 'Could not load your flights',
    loadingPlans: 'Loading flights...',
    windowClosesIn: 'Window closes in {time}',
    windowOpensIn: 'Window opens in {time}',
    activationOpen: 'Activation window open',
    termsRegion: 'Terms and conditions',
    colActivation: 'Activation',
    colActivatedAt: 'Activated at',
    historyRegion: 'Flight history list',
    statusActivable: 'Activatable',
    statusActivating: 'Activating',
    statusTakeoffCleared: 'Cleared for takeoff',
    statusDenied: 'Activation denied',
    statusWindowPassed: 'Window passed',
    statusNotActivable: 'Not activatable',
  },
  authForm: {
    tabsLabel: 'Account access',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    optional: '(optional)',
    verificationCode: 'Verification code',
    submitting: 'Please wait...',
    signingIn: 'Logging in...',
    creatingAccount: 'Creating account...',
    showPolicy: 'Opens in a new tab',
  },
  account: {
    profileTitle: 'Profile',
    profileSubtitle: 'Your account information',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    firstNamePlaceholder: 'Enter your first name',
    lastNamePlaceholder: 'Enter your last name',
    phonePlaceholder: 'Enter your phone number',
    save: 'Save profile',
    saving: 'Saving...',
    saved: 'Profile updated successfully',
    saveFailed: 'Failed to update profile',
    loadFailed: 'Could not load your profile details.',
    activeAccount: 'Active account',
    email: 'Email',
    notSet: 'Not set',
    accountId: 'Account ID',
    userFallback: 'User',
    settingsTitle: 'Settings',
    settingsSubtitle: 'Customize your experience',
    appearance: 'Appearance',
    appearanceHint: 'Choose how the application looks on your device',
    themeDark: 'Dark',
    themeDarkHint: 'Dark theme for low-light environments',
    themeLight: 'Light',
    themeLightHint: 'Light theme for bright environments',
    languageHint: 'Choose your preferred language',
    quickLinks: 'Quick links',
    contactHint: 'Get in touch with our team',
    howItWorksHint: 'Learn about the system',
    privacyHint: 'How we handle your data',
    selected: 'Selected',
    notificationsSoon: 'Notification preferences coming soon',
    notificationsSoonDetail: 'Email and push notification settings will be available in a future update.',
  },
}

export const pageEs: PageTranslations = {
  titles: {
    appName: 'UPPS',
    siteDescription: 'UPPS: servicio de preparación de U-plans y planes de vuelo para operadores de drones.',
    launch: 'Inicio',
    login: 'Acceso',
    forgotPassword: 'Recuperar contraseña',
    resetPassword: 'Restablecer contraseña',
    verifyEmail: 'Verificar correo',
    contact: 'Contacto',
    howItWorks: 'Cómo funciona',
    privacy: 'Política de privacidad',
    planDefinition: 'Definición de planes',
    planAuthorization: 'Autorización de planes',
    planActivation: 'Activación de planes',
    profile: 'Perfil',
    settings: 'Ajustes',
  },
  boundary: {
    errorTitle: 'Algo ha salido mal',
    errorBody: 'Se ha producido un error inesperado. Puedes intentarlo de nuevo.',
    retry: 'Reintentar',
    notFoundTitle: 'Página no encontrada',
    notFoundBody: 'La dirección no existe o se ha movido.',
    backHome: 'Volver al inicio',
    loading: 'Cargando...',
    globalErrorTitle: 'Algo ha salido mal',
    globalErrorBody: 'La aplicación ha tenido un error grave. Puedes intentarlo de nuevo.',
  },
  shell: {
    mainNav: 'Navegación principal',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    userMenu: 'Menú de cuenta',
    brandHome: 'Inicio de PAUTHFLY',
    profileAlt: 'Perfil de usuario',
    verifyingAuth: 'Verificando autenticación...',
    redirectingToLogin: 'Redirigiendo al acceso...',
    connect: 'Síguenos',
    apps: 'Aplicaciones',
    information: 'Información',
    rightsReserved: 'Todos los derechos reservados.',
  },
  activation: {
    readyNow: 'Listos ahora',
    readyNowHint: 'Vuelos dentro de su ventana de activación (1 minuto antes o después de la hora programada).',
    upcoming: 'Próximos',
    upcomingHint: 'Vuelos autorizados programados pronto. La activación se abre 1 minuto antes de la hora programada.',
    upcomingEmpty: 'No hay vuelos autorizados programados en las próximas 24 horas.',
    emptyTitle: 'No hay planes autorizados programados',
    emptyBody: 'Los planes aprobados con hora programada aparecen aquí. Autoriza un plan para dejarlo listo para activar.',
    emptyCta: 'Ir a Autorización de planes',
    loadErrorTitle: 'No se pudieron cargar tus vuelos',
    loadingPlans: 'Cargando vuelos...',
    windowClosesIn: 'La ventana se cierra en {time}',
    windowOpensIn: 'La ventana se abre en {time}',
    activationOpen: 'Ventana de activación abierta',
    termsRegion: 'Términos y condiciones',
    colActivation: 'Activación',
    colActivatedAt: 'Activado el',
    historyRegion: 'Lista del historial de vuelos',
    statusActivable: 'Activable',
    statusActivating: 'Activando',
    statusTakeoffCleared: 'Autorizado a despegar',
    statusDenied: 'Activación denegada',
    statusWindowPassed: 'Ventana pasada',
    statusNotActivable: 'No activable',
  },
  authForm: {
    tabsLabel: 'Acceso a la cuenta',
    firstName: 'Nombre',
    lastName: 'Apellidos',
    phone: 'Teléfono',
    optional: '(opcional)',
    verificationCode: 'Código de verificación',
    submitting: 'Espera...',
    signingIn: 'Accediendo...',
    creatingAccount: 'Creando cuenta...',
    showPolicy: 'Se abre en una pestaña nueva',
  },
  account: {
    profileTitle: 'Perfil',
    profileSubtitle: 'Datos de tu cuenta',
    firstName: 'Nombre',
    lastName: 'Apellidos',
    phone: 'Teléfono',
    firstNamePlaceholder: 'Escribe tu nombre',
    lastNamePlaceholder: 'Escribe tus apellidos',
    phonePlaceholder: 'Escribe tu teléfono',
    save: 'Guardar perfil',
    saving: 'Guardando...',
    saved: 'Perfil actualizado correctamente',
    saveFailed: 'No se pudo actualizar el perfil',
    loadFailed: 'No se pudieron cargar los datos del perfil.',
    activeAccount: 'Cuenta activa',
    email: 'Correo',
    notSet: 'Sin definir',
    accountId: 'ID de cuenta',
    userFallback: 'Usuario',
    settingsTitle: 'Ajustes',
    settingsSubtitle: 'Personaliza tu experiencia',
    appearance: 'Apariencia',
    appearanceHint: 'Elige el aspecto de la aplicación en tu dispositivo',
    themeDark: 'Oscuro',
    themeDarkHint: 'Tema oscuro para entornos con poca luz',
    themeLight: 'Claro',
    themeLightHint: 'Tema claro para entornos luminosos',
    languageHint: 'Elige tu idioma preferido',
    quickLinks: 'Enlaces rápidos',
    contactHint: 'Ponte en contacto con el equipo',
    howItWorksHint: 'Conoce el sistema',
    privacyHint: 'Cómo tratamos tus datos',
    selected: 'Seleccionado',
    notificationsSoon: 'Las preferencias de notificaciones llegarán pronto',
    notificationsSoonDetail: 'Los ajustes de notificaciones por correo y push estarán disponibles en una próxima actualización.',
  },
}
