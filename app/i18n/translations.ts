/**
 * Internationalization (i18n) System
 * 
 * Translations for the UAS Planner application.
 * Default language: English (en)
 * Supported languages: English (en), Spanish (es)
 */

export type Language = 'en' | 'es'

export interface Translations {
  // Common
  common: {
    loading: string
    error: string
    success: string
    cancel: string
    confirm: string
    save: string
    delete: string
    edit: string
    close: string
    retry: string
    search: string
    noResults: string
    yes: string
    no: string
    or: string
    and: string
    required: string
    optional: string
  }
  
  // Auth
  auth: {
    login: string
    logout: string
    signUp: string
    signedInAs: string
    email: string
    password: string
    confirmPassword: string
    forgotPassword: string
    rememberMe: string
    loginError: string
    invalidCredentials: string
    sessionExpired: string
    pleaseLogin: string
  }
  
  // Navigation
  nav: {
    home: string
    planGenerator: string
    trajectoryGenerator: string
    planActivation: string
    profile: string
    settings: string
    howItWorks: string
    contactUs: string
    privacyPolicy: string
  }
  
  // Flight Plans / Trajectory Generator
  flightPlans: {
    title: string
    subtitle: string
    flightPlan: string
    flightPlans: string
    folder: string
    folders: string
    noFolder: string
    plansWithoutFolder: string
    createFolder: string
    renameFolder: string
    deleteFolder: string
    newFolderName: string
    folderName: string
    selectPlan: string
    selectedPlan: string
    deselect: string
    noPlansSelected: string
    selectPlanToStart: string
    processPlan: string
    processing: string
    processed: string
    unprocessed: string
    inQueue: string
    error: string
    viewTrajectory: string
    downloadCsv: string
    authorize: string
    authorizing: string
    authorized: string
    denied: string
    pending: string
    noAuthorization: string
    reset: string
    resetting: string
    scheduledFor: string
    selectDateTime: string
    dateTimeLocked: string
    dateTimeLockedMsg: string
    dropHereToRemove: string
    dragToMove: string
    
    // Status messages
    noTrajectory: string
    processFirst: string
    alreadyProcessed: string
    selectDateFirst: string
    processingInProgress: string
    alreadyAuthorized: string
    authorizationPending: string
    nothingToReset: string
    
    // Workflow
    workflow: string
    workflowSteps: {
      select: string
      datetime: string
      process: string
      geoawareness: string
      authorize: string
    }
    
    // Actions
    confirmProcess: string
    confirmProcessMsg: string
    confirmReset: string
    confirmResetMsg: string
    confirmDelete: string
    confirmDeleteFolder: string
    
    // U-Plan verification
    uplanVerification: string
    uplanVerificationMsg: string
    verifyUplan: string
    uplanVerified: string
    
    // GeoAwareness
    geoawareness: string
    geoawarenessTitle: string
    geoawarenessNotAvailable: string
    viewGeoawareness: string
    reviewGeoawareness: string
    continueToAuth: string
    
    // Authorization response
    authResponse: string
    viewAuthResponse: string
    
    // Trajectory viewer
    trajectoryViewer: string
    trajectory: string
    points: string
    altitude: string
    showNumbers: string
    takeoff: string
    landing: string
    waypoint: string
    selectedPoint: string
    loadingTrajectory: string
    noValidTrajectory: string
    errorLoadingPlan: string
    
    // Waypoint preview
    waypointPreview: string
    noWaypoints: string
    expandMap: string
    
    // Sync
    syncing: string
    syncPaused: string
    syncError: string
    
    // Success/Error messages
    dateUpdated: string
    dateUpdateError: string
    nameUpdated: string
    nameUpdateError: string
    planMoved: string
    planMoveError: string
    planReset: string
    planResetError: string
    authRequestSent: string
    authRequestError: string
    planDeleted: string
    planDeleteError: string
    folderCreated: string
    folderCreateError: string
    folderRenamed: string
    folderRenameError: string
    folderDeleted: string
    folderDeleteError: string
  }
  
  // Plan Generator
  planGenerator: {
    title: string
    waypoints: string
    addWaypoint: string
    removeWaypoint: string
    clearAll: string
    generatePlan: string
    downloadPlan: string
    uploadPlan: string
    flightDetails: string
    altitude: string
    speed: string
    pauseDuration: string
    flyOver: string
    flyBy: string
    scanPattern: string
    serviceArea: string
    serviceAreaBounds: string
    nearBoundary: string
    outsideServiceArea: string
  }
  
  // Settings
  settings: {
    title: string
    language: string
    selectLanguage: string
    theme: string
    darkTheme: string
    lightTheme: string
    systemTheme: string
    notifications: string
    account: string
    changePassword: string
    deleteAccount: string
  }
  
  // Errors
  errors: {
    generic: string
    network: string
    unauthorized: string
    notFound: string
    validation: string
    serverError: string
    loadingFailed: string
  }
  
  // Time/Date
  time: {
    now: string
    justNow: string
    minutesAgo: string
    hoursAgo: string
    daysAgo: string
    inMinutes: string
    inHours: string
    inDays: string
  }
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      retry: 'Retry',
      search: 'Search',
      noResults: 'No results found',
      yes: 'Yes',
      no: 'No',
      or: 'or',
      and: 'and',
      required: 'Required',
      optional: 'Optional',
    },
    auth: {
      login: 'Log in',
      logout: 'Log out',
      signUp: 'Sign up',
      signedInAs: 'Signed in as',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
      forgotPassword: 'Forgot password?',
      rememberMe: 'Remember me',
      loginError: 'Login failed',
      invalidCredentials: 'Invalid credentials',
      sessionExpired: 'Session expired',
      pleaseLogin: 'Please log in to view your flight plans.',
    },
    nav: {
      home: 'Home',
      planGenerator: 'Plan Generator',
      trajectoryGenerator: 'Trajectory Generator',
      planActivation: 'Plan Activation',
      profile: 'Profile',
      settings: 'Settings',
      howItWorks: 'How it Works',
      contactUs: 'Contact Us',
      privacyPolicy: 'Privacy Policy',
    },
    flightPlans: {
      title: 'Trajectory Generator',
      subtitle: 'Manage and process your flight plans',
      flightPlan: 'Flight Plan',
      flightPlans: 'Flight Plans',
      folder: 'Folder',
      folders: 'Folders',
      noFolder: 'No folder',
      plansWithoutFolder: 'Plans without folder',
      createFolder: 'Create folder',
      renameFolder: 'Rename folder',
      deleteFolder: 'Delete folder',
      newFolderName: 'New folder name',
      folderName: 'Folder name',
      selectPlan: 'Select plan',
      selectedPlan: 'Selected plan',
      deselect: 'Deselect',
      noPlansSelected: 'No plans selected',
      selectPlanToStart: 'Select a flight plan from the list to begin',
      processPlan: 'Process plan',
      processing: 'Processing',
      processed: 'Processed',
      unprocessed: 'Unprocessed',
      inQueue: 'In queue',
      error: 'Error',
      viewTrajectory: 'View trajectory',
      downloadCsv: 'Download CSV',
      authorize: 'Authorize',
      authorizing: 'Authorizing...',
      authorized: 'Authorized',
      denied: 'Denied',
      pending: 'Pending',
      noAuthorization: 'No authorization',
      reset: 'Reset',
      resetting: 'Resetting...',
      scheduledFor: 'Scheduled for',
      selectDateTime: 'Select the date and time to process the plan.',
      dateTimeLocked: 'Date locked',
      dateTimeLockedMsg: 'The date cannot be modified after processing starts.',
      dropHereToRemove: 'Drop here to remove from folder',
      dragToMove: 'Drag to move',
      
      noTrajectory: 'No trajectory available',
      processFirst: 'Process trajectory first',
      alreadyProcessed: 'Already processed',
      selectDateFirst: 'Select date/time first',
      processingInProgress: 'Processing in progress',
      alreadyAuthorized: 'Already authorized',
      authorizationPending: 'Authorization pending',
      nothingToReset: 'Nothing to reset',
      
      workflow: 'Workflow',
      workflowSteps: {
        select: 'Select',
        datetime: 'Date/Time',
        process: 'Process',
        geoawareness: 'GeoAwareness',
        authorize: 'Authorize',
      },
      
      confirmProcess: 'Confirm processing',
      confirmProcessMsg: 'Are you sure you want to process the plan "{planName}"? Once processing starts, you will not be able to modify the scheduled date and time, or the plan information without resetting the entire process.',
      confirmReset: 'Reset flight plan',
      confirmResetMsg: 'Are you sure you want to reset the plan "{planName}"? This action will delete the processed trajectory, authorization status, and all associated data. The plan will return to "unprocessed" status.',
      confirmDelete: 'Are you sure you want to delete this flight plan?',
      confirmDeleteFolder: 'Are you sure you want to delete this folder and all its flight plans?',
      
      uplanVerification: 'U-Plan Verification',
      uplanVerificationMsg: 'Before processing, please verify that all U-Plan data is correct. Open the U-Plan form and confirm all entered information.',
      verifyUplan: 'Verify U-Plan',
      uplanVerified: 'U-Plan verified',
      
      geoawareness: 'GeoAwareness',
      geoawarenessTitle: 'GeoAwareness Information',
      geoawarenessNotAvailable: 'GeoAwareness Service not available',
      viewGeoawareness: 'View GeoAwareness',
      reviewGeoawareness: 'The plan has been processed. Review the geoawareness information before requesting authorization.',
      continueToAuth: 'Continue to authorization',
      
      authResponse: 'Authorization Response',
      viewAuthResponse: 'View response',
      
      trajectoryViewer: 'Trajectory Viewer',
      trajectory: 'Trajectory',
      points: 'points',
      altitude: 'altitude',
      showNumbers: 'Show numbers',
      takeoff: 'Takeoff',
      landing: 'Landing',
      waypoint: 'Waypoint',
      selectedPoint: 'Selected point',
      loadingTrajectory: 'Loading trajectory...',
      noValidTrajectory: 'No valid trajectory data in CSV',
      errorLoadingPlan: 'Error loading plan',
      
      waypointPreview: 'Waypoint Preview',
      noWaypoints: 'No waypoints',
      expandMap: 'Click to expand map',
      
      syncing: 'Syncing...',
      syncPaused: 'Automatic sync has been paused due to connection errors.',
      syncError: 'Sync error',
      
      dateUpdated: 'Date and time updated.',
      dateUpdateError: 'Error updating date.',
      nameUpdated: 'Plan name updated.',
      nameUpdateError: 'Error renaming plan.',
      planMoved: 'Plan moved successfully.',
      planMoveError: 'Error moving plan.',
      planReset: 'Plan reset successfully.',
      planResetError: 'Error resetting plan.',
      authRequestSent: 'Authorization request sent successfully.',
      authRequestError: 'Error requesting authorization.',
      planDeleted: 'Plan deleted.',
      planDeleteError: 'Error deleting plan.',
      folderCreated: 'Folder created.',
      folderCreateError: 'Error creating folder.',
      folderRenamed: 'Folder renamed.',
      folderRenameError: 'Error renaming folder.',
      folderDeleted: 'Folder deleted.',
      folderDeleteError: 'Error deleting folder.',
    },
    planGenerator: {
      title: 'Plan Generator',
      waypoints: 'Waypoints',
      addWaypoint: 'Add waypoint',
      removeWaypoint: 'Remove waypoint',
      clearAll: 'Clear all',
      generatePlan: 'Generate plan',
      downloadPlan: 'Download plan',
      uploadPlan: 'Upload plan',
      flightDetails: 'Flight details',
      altitude: 'Altitude',
      speed: 'Speed',
      pauseDuration: 'Pause duration',
      flyOver: 'Fly-over',
      flyBy: 'Fly-by',
      scanPattern: 'SCAN pattern',
      serviceArea: 'Service area',
      serviceAreaBounds: 'Service area bounds',
      nearBoundary: 'Near boundary',
      outsideServiceArea: 'Outside service area',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      selectLanguage: 'Select language',
      theme: 'Theme',
      darkTheme: 'Dark',
      lightTheme: 'Light',
      systemTheme: 'System',
      notifications: 'Notifications',
      account: 'Account',
      changePassword: 'Change password',
      deleteAccount: 'Delete account',
    },
    errors: {
      generic: 'An error occurred',
      network: 'Network error',
      unauthorized: 'Unauthorized',
      notFound: 'Not found',
      validation: 'Validation error',
      serverError: 'Server error',
      loadingFailed: 'Failed to load data',
    },
    time: {
      now: 'now',
      justNow: 'just now',
      minutesAgo: '{n} minutes ago',
      hoursAgo: '{n} hours ago',
      daysAgo: '{n} days ago',
      inMinutes: 'in {n} minutes',
      inHours: 'in {n} hours',
      inDays: 'in {n} days',
    },
  },
  
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      retry: 'Reintentar',
      search: 'Buscar',
      noResults: 'No se encontraron resultados',
      yes: 'Sí',
      no: 'No',
      or: 'o',
      and: 'y',
      required: 'Requerido',
      optional: 'Opcional',
    },
    auth: {
      login: 'Iniciar sesión',
      logout: 'Cerrar sesión',
      signUp: 'Registrarse',
      signedInAs: 'Conectado como',
      email: 'Correo electrónico',
      password: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      forgotPassword: '¿Olvidaste tu contraseña?',
      rememberMe: 'Recordarme',
      loginError: 'Error de inicio de sesión',
      invalidCredentials: 'Credenciales inválidas',
      sessionExpired: 'Sesión expirada',
      pleaseLogin: 'Por favor, inicie sesión para ver sus planes de vuelo.',
    },
    nav: {
      home: 'Inicio',
      planGenerator: 'Generador de Planes',
      trajectoryGenerator: 'Generador de Trayectorias',
      planActivation: 'Activación de Planes',
      profile: 'Perfil',
      settings: 'Configuración',
      howItWorks: 'Cómo Funciona',
      contactUs: 'Contáctenos',
      privacyPolicy: 'Política de Privacidad',
    },
    flightPlans: {
      title: 'Generador de Trayectorias',
      subtitle: 'Gestione y procese sus planes de vuelo',
      flightPlan: 'Plan de vuelo',
      flightPlans: 'Planes de vuelo',
      folder: 'Carpeta',
      folders: 'Carpetas',
      noFolder: 'Sin carpeta',
      plansWithoutFolder: 'Planes sin carpeta',
      createFolder: 'Crear carpeta',
      renameFolder: 'Renombrar carpeta',
      deleteFolder: 'Eliminar carpeta',
      newFolderName: 'Nuevo nombre de carpeta',
      folderName: 'Nombre de carpeta',
      selectPlan: 'Seleccionar plan',
      selectedPlan: 'Plan seleccionado',
      deselect: 'Deseleccionar',
      noPlansSelected: 'Ningún plan seleccionado',
      selectPlanToStart: 'Seleccione un plan de vuelo de la lista para comenzar',
      processPlan: 'Procesar plan',
      processing: 'Procesando',
      processed: 'Procesado',
      unprocessed: 'Sin procesar',
      inQueue: 'En cola',
      error: 'Error',
      viewTrajectory: 'Ver trayectoria',
      downloadCsv: 'Descargar CSV',
      authorize: 'Autorizar',
      authorizing: 'Solicitando...',
      authorized: 'Autorizado',
      denied: 'Denegado',
      pending: 'Pendiente',
      noAuthorization: 'Sin autorización',
      reset: 'Reiniciar',
      resetting: 'Reiniciando...',
      scheduledFor: 'Programado para',
      selectDateTime: 'Seleccione la fecha y hora para procesar el plan.',
      dateTimeLocked: 'Fecha bloqueada',
      dateTimeLockedMsg: 'La fecha no puede modificarse después de iniciar el procesamiento.',
      dropHereToRemove: 'Soltar aquí para quitar de carpeta',
      dragToMove: 'Arrastrar para mover',
      
      noTrajectory: 'No hay trayectoria disponible',
      processFirst: 'Procese la trayectoria primero',
      alreadyProcessed: 'Ya procesado',
      selectDateFirst: 'Seleccione fecha/hora primero',
      processingInProgress: 'Procesamiento en curso',
      alreadyAuthorized: 'Ya autorizado',
      authorizationPending: 'Autorización pendiente',
      nothingToReset: 'Nada que reiniciar',
      
      workflow: 'Flujo de trabajo',
      workflowSteps: {
        select: 'Seleccionar',
        datetime: 'Fecha/Hora',
        process: 'Procesar',
        geoawareness: 'GeoAwareness',
        authorize: 'Autorizar',
      },
      
      confirmProcess: 'Confirmar procesamiento',
      confirmProcessMsg: '¿Está seguro de que desea procesar el plan "{planName}"? Una vez iniciado el procesamiento, no podrá modificar la fecha y hora programada, ni la información del plan sin reiniciar todo el proceso.',
      confirmReset: 'Reiniciar plan de vuelo',
      confirmResetMsg: '¿Está seguro de que desea reiniciar el plan "{planName}"? Esta acción eliminará la trayectoria procesada, el estado de autorización y todos los datos asociados. El plan volverá al estado "sin procesar".',
      confirmDelete: '¿Está seguro de eliminar este plan de vuelo?',
      confirmDeleteFolder: '¿Está seguro de eliminar esta carpeta y todos sus planes de vuelo?',
      
      uplanVerification: 'Verificación de U-Plan',
      uplanVerificationMsg: 'Antes de procesar, por favor verifique que todos los datos del U-Plan son correctos. Abra el formulario del U-Plan y confirme toda la información introducida.',
      verifyUplan: 'Verificar U-Plan',
      uplanVerified: 'U-Plan verificado',
      
      geoawareness: 'GeoAwareness',
      geoawarenessTitle: 'Información de GeoAwareness',
      geoawarenessNotAvailable: 'Servicio de GeoAwareness no disponible',
      viewGeoawareness: 'Ver GeoAwareness',
      reviewGeoawareness: 'El plan ha sido procesado. Revise la información de geoawareness antes de solicitar autorización.',
      continueToAuth: 'Continuar a autorización',
      
      authResponse: 'Respuesta de Autorización',
      viewAuthResponse: 'Ver respuesta',
      
      trajectoryViewer: 'Visor de Trayectoria',
      trajectory: 'Trayectoria',
      points: 'puntos',
      altitude: 'altitud',
      showNumbers: 'Mostrar números',
      takeoff: 'Despegue',
      landing: 'Aterrizaje',
      waypoint: 'Punto',
      selectedPoint: 'Punto seleccionado',
      loadingTrajectory: 'Cargando trayectoria...',
      noValidTrajectory: 'CSV sin datos de trayectoria válidos',
      errorLoadingPlan: 'Error al obtener plan',
      
      waypointPreview: 'Vista previa de waypoints',
      noWaypoints: 'Sin waypoints',
      expandMap: 'Clic para ampliar mapa',
      
      syncing: 'Sincronizando...',
      syncPaused: 'La sincronización automática se ha pausado debido a errores de conexión.',
      syncError: 'Error de sincronización',
      
      dateUpdated: 'Fecha y hora actualizada.',
      dateUpdateError: 'Error al actualizar la fecha.',
      nameUpdated: 'Nombre del plan actualizado.',
      nameUpdateError: 'Error al renombrar el plan.',
      planMoved: 'Plan movido correctamente.',
      planMoveError: 'Error al mover el plan.',
      planReset: 'Plan reiniciado correctamente.',
      planResetError: 'Error al reiniciar el plan.',
      authRequestSent: 'Solicitud de autorización enviada correctamente.',
      authRequestError: 'Error al solicitar autorización.',
      planDeleted: 'Plan eliminado.',
      planDeleteError: 'Error al eliminar el plan.',
      folderCreated: 'Carpeta creada.',
      folderCreateError: 'Error al crear carpeta.',
      folderRenamed: 'Carpeta renombrada.',
      folderRenameError: 'Error al renombrar carpeta.',
      folderDeleted: 'Carpeta eliminada.',
      folderDeleteError: 'Error al eliminar carpeta.',
    },
    planGenerator: {
      title: 'Generador de Planes',
      waypoints: 'Waypoints',
      addWaypoint: 'Añadir waypoint',
      removeWaypoint: 'Eliminar waypoint',
      clearAll: 'Limpiar todo',
      generatePlan: 'Generar plan',
      downloadPlan: 'Descargar plan',
      uploadPlan: 'Subir plan',
      flightDetails: 'Detalles del vuelo',
      altitude: 'Altitud',
      speed: 'Velocidad',
      pauseDuration: 'Duración de pausa',
      flyOver: 'Fly-over',
      flyBy: 'Fly-by',
      scanPattern: 'Patrón SCAN',
      serviceArea: 'Área de servicio',
      serviceAreaBounds: 'Límites del área de servicio',
      nearBoundary: 'Cerca del límite',
      outsideServiceArea: 'Fuera del área de servicio',
    },
    settings: {
      title: 'Configuración',
      language: 'Idioma',
      selectLanguage: 'Seleccionar idioma',
      theme: 'Tema',
      darkTheme: 'Oscuro',
      lightTheme: 'Claro',
      systemTheme: 'Sistema',
      notifications: 'Notificaciones',
      account: 'Cuenta',
      changePassword: 'Cambiar contraseña',
      deleteAccount: 'Eliminar cuenta',
    },
    errors: {
      generic: 'Ha ocurrido un error',
      network: 'Error de red',
      unauthorized: 'No autorizado',
      notFound: 'No encontrado',
      validation: 'Error de validación',
      serverError: 'Error del servidor',
      loadingFailed: 'Error al cargar datos',
    },
    time: {
      now: 'ahora',
      justNow: 'hace un momento',
      minutesAgo: 'hace {n} minutos',
      hoursAgo: 'hace {n} horas',
      daysAgo: 'hace {n} días',
      inMinutes: 'en {n} minutos',
      inHours: 'en {n} horas',
      inDays: 'en {n} días',
    },
  },
}

export const defaultLanguage: Language = 'en'

export function getTranslation(lang: Language): Translations {
  return translations[lang] || translations[defaultLanguage]
}
