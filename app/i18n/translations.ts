/**
 * Internationalization (i18n) System
 * 
 * Translations for the UPPS application.
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
    // Email verification
    verifyEmail: string
    verifyYourEmail: string
    enterVerificationCode: string
    verificationCodePlaceholder: string
    verifying: string
    emailVerified: string
    emailVerifiedSuccess: string
    verificationFailed: string
    verificationLinkExpired: string
    resendCode: string
    resending: string
    codeSent: string
    backToLogin: string
    goToLogin: string
    enterCodeManually: string
    // Password reset
    forgotPasswordTitle: string
    forgotPasswordDesc: string
    sendResetLink: string
    sending: string
    resetLinkSent: string
    resetLinkSentDesc: string
    resetPassword: string
    resetPasswordTitle: string
    newPassword: string
    confirmNewPassword: string
    passwordsDoNotMatch: string
    passwordResetSuccess: string
    passwordResetSuccessDesc: string
    invalidResetLink: string
    requestNewResetLink: string
    resettingPassword: string
    invalidLink: string
    enterNewPasswordDesc: string
    passwordMinLength: string
    errorOccurredRetry: string
    invalidOrExpiredCode: string
    waitBeforeResend: string
    errorSendingVerification: string
    errorCreatingAccount: string
    invalidEmailDomain: string
    demoDisclaimer: string
    acceptPolicyRequired: string
    acceptPrivacyPolicy: string
    alreadyHaveAccount: string
    dontHaveAccount: string
    advice: string
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
  
  // Flight Plans / Plan Authorization
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
    
    // Denial map
    denialMapTitle: string
    denialAuthorization: string
    conflictingVolume: string
    okVolume: string
    conflictingGeozone: string
    conflictingGeozones: string
    conflictingVolumesDetected: string
    reviewDenialDetails: string
    noSpatialData: string
    viewDenialMap: string
    viewRawJson: string
    viewDenialDetails: string
    fasReason: string
    contactDifferentFAS: string
    fasDenialReasonHeader: string
    geozoneConflictDetails: string
    
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
    
    // External UPLAN import
    externalUplanImport: string
    externalUplanSuccess: string
    externalUplanError: string
    externalUplanInvalidFormat: string
    dropUplanHere: string
    noTrajectoryAvailable: string
    
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
    
    // Additional UI strings
    dropHere: string
    emptyFolder: string
    folderNameEmpty: string
    folderNameExists: string
    planNameEmpty: string
    planNameMaxLength: string
    fasProcessing: string
    trajectoryDataNotAvailable: string
    noTrajectoryToProcess: string
    planMustBeProcessed: string
    scheduled: string
    actionCannotBeUndone: string
    
    // Geoawareness viewer
    loadingGeoawarenessData: string
    loadingTrajectoryData: string
    geoawarenessError: string
    failedLoadGeoawareness: string
    flightPlanNotFound: string
    trajectoryDataNotFound: string
    geoawarenessMapTitle: string
    selectPlanToViewGeoawareness: string
    mapLegend: string
    violationsDetected: string
    showGeozones: string
    dronePosition: string
    operationVolume: string
    violationZone: string
    noUspace: string
    geozonesLabel: string
    playSimulation: string
    pauseSimulation: string
    resetToStart: string
    drone: string
    pointLabel: string
    lat: string
    lng: string
    alt: string
    timeLabel: string
    ordinal: string
    startLabel: string
    endLabel: string
    typeLabel: string
    conflictingStatus: string
    okStatus: string
  }
  
  // Plan Definition
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
    latitude: string
    longitude: string
    pause: string
    scanPatternGenerator: string
    step1Takeoff: string
    step2Polygon: string
    step3Landing: string
    step4Parameters: string
    clickMapTakeoff: string
    takeoffPointSet: string
    continueToDraw: string
    clickMapVertices: string
    addAtLeast3: string
    clickNearFirst: string
    useCloseButton: string
    polygonClosedMsg: string
    vertices: string
    closePolygon: string
    editPolygon: string
    continueText: string
    clickMapLanding: string
    landingDescription: string
    landingPointSet: string
    skipUseLastWaypoint: string
    continueToParameters: string
    configureGenerate: string
    flightAltitude: string
    lineSpacing: string
    distanceBetweenLines: string
    scanAngleLabel: string
    advancedOptions: string
    errorsLabel: string
    warningsLabel: string
    patternGenerated: string
    scanLines: string
    distanceLabel: string
    estTime: string
    coverageAreaLabel: string
    startOver: string
    applyPattern: string
    vertex: string
    takeoffPointLabel: string
    landingPointLabel: string
    clickNearToClose: string
    area: string
    clear: string
    deleteVertex: string
    invalidNumber: string
    latRange: string
    lngRange: string
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
  
  // Contact Page
  contactPage: {
    title: string
    subtitle: string
    subject: string
    subjectPlaceholder: string
    category: string
    description: string
    descriptionPlaceholder: string
    submit: string
    submitting: string
    loginRequired: string
    ticketSuccess: string
    ticketNumber: string
    confirmationSent: string
    submitAnother: string
    demoNote: string
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
      verifyEmail: 'Email Verification',
      verifyYourEmail: 'Verify Your Email',
      enterVerificationCode: 'Enter the 6-digit code sent to your email address.',
      verificationCodePlaceholder: '6-digit code',
      verifying: 'Verifying...',
      emailVerified: 'Email verified',
      emailVerifiedSuccess: 'Your email has been verified successfully!',
      verificationFailed: 'Verification failed',
      verificationLinkExpired: 'Verification failed. The link may have expired.',
      resendCode: 'Resend verification code',
      resending: 'Sending...',
      codeSent: 'A new code has been sent.',
      backToLogin: 'Back to Login',
      goToLogin: 'Go to Login',
      enterCodeManually: 'Enter code manually',
      forgotPasswordTitle: 'Forgot Password',
      forgotPasswordDesc: 'Enter your email address and we\'ll send you a link to reset your password.',
      sendResetLink: 'Send Reset Link',
      sending: 'Sending...',
      resetLinkSent: 'Check Your Email',
      resetLinkSentDesc: 'If an account with that email exists, we\'ve sent a password reset link. Please check your inbox.',
      resetPassword: 'Reset Password',
      resetPasswordTitle: 'Reset Password',
      newPassword: 'New password',
      confirmNewPassword: 'Confirm new password',
      passwordsDoNotMatch: 'Passwords do not match.',
      passwordResetSuccess: 'Password Reset',
      passwordResetSuccessDesc: 'Your password has been reset successfully!',
      invalidResetLink: 'This password reset link is invalid or has expired.',
      requestNewResetLink: 'Request a new reset link',
      resettingPassword: 'Resetting...',
      invalidLink: 'Invalid Link',
      enterNewPasswordDesc: 'Enter your new password below.',
      passwordMinLength: 'Password must be at least 8 characters.',
      errorOccurredRetry: 'An error occurred. Please try again.',
      invalidOrExpiredCode: 'Invalid or expired code.',
      waitBeforeResend: 'Please wait before requesting a new code.',
      errorSendingVerification: 'Error sending verification email.',
      errorCreatingAccount: 'Error creating account',
      invalidEmailDomain: 'The email domain does not exist or does not accept emails',
      demoDisclaimer: 'This is a demonstration version and may include bugs or not work as expected.',
      acceptPolicyRequired: 'You must accept the Privacy Policy and DEMO disclaimer to sign up.',
      acceptPrivacyPolicy: 'I accept the {link} and understand this is a DEMO version',
      alreadyHaveAccount: 'Already have an account?',
      dontHaveAccount: "Don't have an account?",
      advice: 'Advice',
    },
    nav: {
      home: 'Home',
      planGenerator: 'Plan Definition',
      trajectoryGenerator: 'Plan Authorization',
      planActivation: 'Plan Activation',
      profile: 'Profile',
      settings: 'Settings',
      howItWorks: 'How it Works',
      contactUs: 'Contact Us',
      privacyPolicy: 'Privacy Policy',
    },
    flightPlans: {
      title: 'Plan Authorization',
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
      
      denialMapTitle: 'Authorization Denial — Map View',
      denialAuthorization: 'Authorization Denied',
      conflictingVolume: 'Conflicting Volume',
      okVolume: 'OK Volume',
      conflictingGeozone: 'Conflicting Geozone',
      conflictingGeozones: 'Conflicting Geozones',
      conflictingVolumesDetected: '{n} conflicting volume(s) detected',
      reviewDenialDetails: 'Review the denial details below',
      noSpatialData: 'No spatial data available to display',
      viewDenialMap: 'View denial on map',
      viewRawJson: 'View raw JSON',
      viewDenialDetails: 'View conflicting volumes and geozones on an interactive map',
      fasReason: 'FAS Reason',
      contactDifferentFAS: 'This operation must be authorized by a different FAS',
      fasDenialReasonHeader: 'FAS Denial Reason',
      geozoneConflictDetails: 'Geozone Conflict Details',
      
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
      
      externalUplanImport: 'Import external UPLAN',
      externalUplanSuccess: 'External UPLAN imported successfully.',
      externalUplanError: 'Error importing external UPLAN.',
      externalUplanInvalidFormat: 'Invalid file: must be a .json file with operationVolumes.',
      dropUplanHere: 'Drop UPLAN .json here',
      noTrajectoryAvailable: 'No trajectory available',
      
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
      
      dropHere: 'Drop here',
      emptyFolder: 'This folder is empty',
      folderNameEmpty: 'Folder name cannot be empty',
      folderNameExists: 'A folder with this name already exists',
      planNameEmpty: 'Name cannot be empty',
      planNameMaxLength: 'Name cannot exceed 100 characters',
      fasProcessing: 'FAS is processing the request',
      trajectoryDataNotAvailable: 'Trajectory data not available',
      noTrajectoryToProcess: 'No trajectory to process',
      planMustBeProcessed: 'Plan must be processed first',
      scheduled: 'Scheduled',
      actionCannotBeUndone: 'This action cannot be undone.',
      
      loadingGeoawarenessData: 'Loading geoawareness data...',
      loadingTrajectoryData: 'Loading trajectory data...',
      geoawarenessError: 'Geoawareness Error',
      failedLoadGeoawareness: 'Failed to load geoawareness data',
      flightPlanNotFound: 'Flight plan not found',
      trajectoryDataNotFound: 'Trajectory data not found',
      geoawarenessMapTitle: 'Geoawareness Map',
      selectPlanToViewGeoawareness: 'Select a flight plan to view trajectory and geoawareness data',
      mapLegend: 'Map Legend',
      violationsDetected: 'Airspace Violations Detected',
      showGeozones: 'Show Geozones',
      dronePosition: 'Drone Position',
      operationVolume: 'Operation Volume',
      violationZone: 'Violation Zone',
      noUspace: 'No U-space',
      geozonesLabel: 'Geozones',
      playSimulation: 'Play simulation',
      pauseSimulation: 'Pause simulation',
      resetToStart: 'Reset to start',
      drone: 'Drone',
      pointLabel: 'Point',
      lat: 'Lat',
      lng: 'Lng',
      alt: 'Alt',
      timeLabel: 'Time',
      ordinal: 'Ordinal',
      startLabel: 'Start',
      endLabel: 'End',
      typeLabel: 'Type',
      conflictingStatus: 'CONFLICTING',
      okStatus: 'OK',
    },
    planGenerator: {
      title: 'Plan Definition',
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
      latitude: 'Latitude',
      longitude: 'Longitude',
      pause: 'Pause',
      scanPatternGenerator: 'SCAN Pattern Generator',
      step1Takeoff: 'Set Takeoff Point',
      step2Polygon: 'Draw Survey Area',
      step3Landing: 'Set Landing Point',
      step4Parameters: 'Configure & Generate',
      clickMapTakeoff: 'Click on the map to set the takeoff/start location for your drone.',
      takeoffPointSet: 'Takeoff point set',
      continueToDraw: 'Continue to Draw Polygon',
      clickMapVertices: 'Click on the map to add polygon vertices.',
      addAtLeast3: 'Add at least 3 points to form a polygon',
      clickNearFirst: 'Click near the first point to close the polygon',
      useCloseButton: 'Or use the "Close Polygon" button below',
      polygonClosedMsg: 'Polygon closed',
      vertices: 'Vertices',
      closePolygon: 'Close Polygon',
      editPolygon: 'Edit Polygon',
      continueText: 'Continue',
      clickMapLanding: 'Click on the map to set the landing location.',
      landingDescription: 'This is where the drone will land after completing the survey.',
      landingPointSet: 'Landing point set',
      skipUseLastWaypoint: 'Skip (Use Last Waypoint)',
      continueToParameters: 'Continue to Parameters',
      configureGenerate: 'Configure & Generate',
      flightAltitude: 'Flight Altitude',
      lineSpacing: 'Line Spacing',
      distanceBetweenLines: 'distance between scan lines',
      scanAngleLabel: 'Scan Angle',
      advancedOptions: 'Advanced Options',
      errorsLabel: 'Errors',
      warningsLabel: 'Warnings',
      patternGenerated: 'Pattern Generated Successfully',
      scanLines: 'Scan Lines',
      distanceLabel: 'Distance',
      estTime: 'Est. Time',
      coverageAreaLabel: 'Coverage Area',
      startOver: 'Start Over',
      applyPattern: 'Apply Pattern',
      vertex: 'Vertex',
      takeoffPointLabel: 'Takeoff Point',
      landingPointLabel: 'Landing Point',
      clickNearToClose: 'Click near here to close polygon',
      area: 'Area',
      clear: 'Clear',
      deleteVertex: 'Delete vertex',
      invalidNumber: 'Invalid number',
      latRange: 'Lat must be -90..90',
      lngRange: 'Lng must be -180..180',
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
    contactPage: {
      title: 'Contact Us',
      subtitle: 'Submit a support ticket and we\'ll get back to you.',
      subject: 'Subject',
      subjectPlaceholder: 'Brief summary of your issue',
      category: 'Category',
      description: 'Description',
      descriptionPlaceholder: 'Describe your issue or request in detail...',
      submit: 'Submit Ticket',
      submitting: 'Submitting...',
      loginRequired: 'Please log in to submit a support ticket.',
      ticketSuccess: 'Ticket submitted successfully!',
      ticketNumber: 'Your ticket number is',
      confirmationSent: 'A confirmation email has been sent.',
      submitAnother: 'Submit another ticket',
      demoNote: 'This is a DEMO version of UPPS. Your input is crucial to help us improve the app. Thank you for testing and sharing your experience!',
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
      verifyEmail: 'Verificación de correo',
      verifyYourEmail: 'Verifica tu correo electrónico',
      enterVerificationCode: 'Introduce el código de 6 dígitos enviado a tu correo electrónico.',
      verificationCodePlaceholder: 'Código de 6 dígitos',
      verifying: 'Verificando...',
      emailVerified: 'Correo verificado',
      emailVerifiedSuccess: '¡Tu correo electrónico ha sido verificado correctamente!',
      verificationFailed: 'Verificación fallida',
      verificationLinkExpired: 'La verificación falló. El enlace puede haber expirado.',
      resendCode: 'Reenviar código de verificación',
      resending: 'Enviando...',
      codeSent: 'Se ha enviado un nuevo código.',
      backToLogin: 'Volver a Iniciar Sesión',
      goToLogin: 'Ir a Iniciar Sesión',
      enterCodeManually: 'Introducir código manualmente',
      forgotPasswordTitle: 'Olvidé mi Contraseña',
      forgotPasswordDesc: 'Introduce tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.',
      sendResetLink: 'Enviar Enlace',
      sending: 'Enviando...',
      resetLinkSent: 'Revisa tu Correo',
      resetLinkSentDesc: 'Si existe una cuenta con ese correo, hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.',
      resetPassword: 'Restablecer Contraseña',
      resetPasswordTitle: 'Restablecer Contraseña',
      newPassword: 'Nueva contraseña',
      confirmNewPassword: 'Confirmar nueva contraseña',
      passwordsDoNotMatch: 'Las contraseñas no coinciden.',
      passwordResetSuccess: 'Contraseña Restablecida',
      passwordResetSuccessDesc: '¡Tu contraseña ha sido restablecida correctamente!',
      invalidResetLink: 'Este enlace de restablecimiento es inválido o ha expirado.',
      requestNewResetLink: 'Solicitar un nuevo enlace',
      resettingPassword: 'Restableciendo...',
      invalidLink: 'Enlace Inválido',
      enterNewPasswordDesc: 'Introduce tu nueva contraseña.',
      passwordMinLength: 'La contraseña debe tener al menos 8 caracteres.',
      errorOccurredRetry: 'Ha ocurrido un error. Por favor, inténtelo de nuevo.',
      invalidOrExpiredCode: 'Código inválido o expirado.',
      waitBeforeResend: 'Espere antes de solicitar un nuevo código.',
      errorSendingVerification: 'Error al enviar el correo de verificación.',
      errorCreatingAccount: 'Error al crear la cuenta',
      invalidEmailDomain: 'El dominio del correo no existe o no acepta emails',
      demoDisclaimer: 'Esta es una versión de demostración y puede incluir errores o no funcionar como se espera.',
      acceptPolicyRequired: 'Debe aceptar la Política de Privacidad y el aviso de DEMO para registrarse.',
      acceptPrivacyPolicy: 'Acepto la {link} y entiendo que es una versión DEMO',
      alreadyHaveAccount: '¿Ya tienes una cuenta?',
      dontHaveAccount: '¿No tienes una cuenta?',
      advice: 'Aviso',
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
      
      denialMapTitle: 'Denegación de Autorización — Vista de Mapa',
      denialAuthorization: 'Autorización Denegada',
      conflictingVolume: 'Volumen en Conflicto',
      okVolume: 'Volumen OK',
      conflictingGeozone: 'Geozona en Conflicto',
      conflictingGeozones: 'Geozonas en Conflicto',
      conflictingVolumesDetected: '{n} volumen(es) en conflicto detectado(s)',
      reviewDenialDetails: 'Revise los detalles de la denegación abajo',
      noSpatialData: 'No hay datos espaciales disponibles para mostrar',
      viewDenialMap: 'Ver denegación en mapa',
      viewRawJson: 'Ver JSON sin procesar',
      viewDenialDetails: 'Ver volúmenes en conflicto y geozonas en un mapa interactivo',
      fasReason: 'Motivo del FAS',
      contactDifferentFAS: 'Esta operación debe ser autorizada por un FAS diferente',
      fasDenialReasonHeader: 'Motivo de Denegación FAS',
      geozoneConflictDetails: 'Detalles de Conflicto de Geozona',
      
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
      
      externalUplanImport: 'Importar UPLAN externo',
      externalUplanSuccess: 'UPLAN externo importado correctamente.',
      externalUplanError: 'Error al importar UPLAN externo.',
      externalUplanInvalidFormat: 'Archivo inválido: debe ser un archivo .json con operationVolumes.',
      dropUplanHere: 'Suelte el UPLAN .json aquí',
      noTrajectoryAvailable: 'No hay trayectoria disponible',
      
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
      
      dropHere: 'Soltar aquí',
      emptyFolder: 'Esta carpeta está vacía',
      folderNameEmpty: 'El nombre de la carpeta no puede estar vacío',
      folderNameExists: 'Ya existe una carpeta con este nombre',
      planNameEmpty: 'El nombre no puede estar vacío',
      planNameMaxLength: 'El nombre no puede superar los 100 caracteres',
      fasProcessing: 'FAS está procesando la solicitud',
      trajectoryDataNotAvailable: 'Datos de trayectoria no disponibles',
      noTrajectoryToProcess: 'Sin trayectoria para procesar',
      planMustBeProcessed: 'El plan debe ser procesado primero',
      scheduled: 'Programado',
      actionCannotBeUndone: 'Esta acción no se puede deshacer.',
      
      loadingGeoawarenessData: 'Cargando datos de geoawareness...',
      loadingTrajectoryData: 'Cargando datos de trayectoria...',
      geoawarenessError: 'Error de GeoAwareness',
      failedLoadGeoawareness: 'Error al cargar datos de geoawareness',
      flightPlanNotFound: 'Plan de vuelo no encontrado',
      trajectoryDataNotFound: 'Datos de trayectoria no encontrados',
      geoawarenessMapTitle: 'Mapa de GeoAwareness',
      selectPlanToViewGeoawareness: 'Seleccione un plan de vuelo para ver la trayectoria y datos de geoawareness',
      mapLegend: 'Leyenda del Mapa',
      violationsDetected: 'Violaciones de Espacio Aéreo Detectadas',
      showGeozones: 'Mostrar Geozonas',
      dronePosition: 'Posición del Dron',
      operationVolume: 'Volumen de Operación',
      violationZone: 'Zona de Violación',
      noUspace: 'Sin U-space',
      geozonesLabel: 'Geozonas',
      playSimulation: 'Reproducir simulación',
      pauseSimulation: 'Pausar simulación',
      resetToStart: 'Volver al inicio',
      drone: 'Dron',
      pointLabel: 'Punto',
      lat: 'Lat',
      lng: 'Lng',
      alt: 'Alt',
      timeLabel: 'Tiempo',
      ordinal: 'Ordinal',
      startLabel: 'Inicio',
      endLabel: 'Fin',
      typeLabel: 'Tipo',
      conflictingStatus: 'EN CONFLICTO',
      okStatus: 'OK',
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
      latitude: 'Latitud',
      longitude: 'Longitud',
      pause: 'Pausa',
      scanPatternGenerator: 'Generador de Patrón SCAN',
      step1Takeoff: 'Establecer Punto de Despegue',
      step2Polygon: 'Dibujar Área de Inspección',
      step3Landing: 'Establecer Punto de Aterrizaje',
      step4Parameters: 'Configurar y Generar',
      clickMapTakeoff: 'Haz clic en el mapa para establecer la ubicación de despegue de tu dron.',
      takeoffPointSet: 'Punto de despegue establecido',
      continueToDraw: 'Continuar a Dibujar Polígono',
      clickMapVertices: 'Haz clic en el mapa para añadir vértices del polígono.',
      addAtLeast3: 'Añade al menos 3 puntos para formar un polígono',
      clickNearFirst: 'Haz clic cerca del primer punto para cerrar el polígono',
      useCloseButton: 'O usa el botón "Cerrar Polígono" abajo',
      polygonClosedMsg: 'Polígono cerrado',
      vertices: 'Vértices',
      closePolygon: 'Cerrar Polígono',
      editPolygon: 'Editar Polígono',
      continueText: 'Continuar',
      clickMapLanding: 'Haz clic en el mapa para establecer la ubicación de aterrizaje.',
      landingDescription: 'Aquí es donde el dron aterrizará tras completar la inspección.',
      landingPointSet: 'Punto de aterrizaje establecido',
      skipUseLastWaypoint: 'Omitir (Usar Último Waypoint)',
      continueToParameters: 'Continuar a Parámetros',
      configureGenerate: 'Configurar y Generar',
      flightAltitude: 'Altitud de Vuelo',
      lineSpacing: 'Espaciado de Líneas',
      distanceBetweenLines: 'distancia entre líneas de escaneo',
      scanAngleLabel: 'Ángulo de Escaneo',
      advancedOptions: 'Opciones Avanzadas',
      errorsLabel: 'Errores',
      warningsLabel: 'Advertencias',
      patternGenerated: 'Patrón Generado Correctamente',
      scanLines: 'Líneas de Escaneo',
      distanceLabel: 'Distancia',
      estTime: 'Tiempo Est.',
      coverageAreaLabel: 'Área de Cobertura',
      startOver: 'Empezar de Nuevo',
      applyPattern: 'Aplicar Patrón',
      vertex: 'Vértice',
      takeoffPointLabel: 'Punto de Despegue',
      landingPointLabel: 'Punto de Aterrizaje',
      clickNearToClose: 'Haz clic cerca para cerrar el polígono',
      area: 'Área',
      clear: 'Limpiar',
      deleteVertex: 'Eliminar vértice',
      invalidNumber: 'Número inválido',
      latRange: 'Lat debe ser -90..90',
      lngRange: 'Lng debe ser -180..180',
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
    contactPage: {
      title: 'Contáctenos',
      subtitle: 'Envíe un ticket de soporte y le responderemos.',
      subject: 'Asunto',
      subjectPlaceholder: 'Resumen breve de su problema',
      category: 'Categoría',
      description: 'Descripción',
      descriptionPlaceholder: 'Describa su problema o solicitud en detalle...',
      submit: 'Enviar Ticket',
      submitting: 'Enviando...',
      loginRequired: 'Inicie sesión para enviar un ticket de soporte.',
      ticketSuccess: '¡Ticket enviado correctamente!',
      ticketNumber: 'Su número de ticket es',
      confirmationSent: 'Se ha enviado un correo de confirmación.',
      submitAnother: 'Enviar otro ticket',
      demoNote: 'Esta es una versión DEMO de UPPS. Su opinión es crucial para mejorar la aplicación. ¡Gracias por probar y compartir su experiencia!',
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
