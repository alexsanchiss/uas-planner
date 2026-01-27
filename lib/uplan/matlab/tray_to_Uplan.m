%% Inicialización
clc; clear;
compression_factor=50; % antes 20
    tray_folder=strcat("C:\Users\ASANMAR4\OneDrive - UPV\SNA\SNA\SNA\Personal\Álex Sanchis\Papers\ICNS Sandra\RandomPlanGeneratorQGC\TRAYECTORIAS\",num2str(casos(l)));
    uplan_folder=strcat("C:\Users\ASANMAR4\OneDrive - UPV\SNA\SNA\SNA\Personal\Álex Sanchis\Papers\ICNS Sandra\RandomPlanGeneratorQGC\UPLAN\",num2str(casos(l)));

    %% BBOX PARAMS
    PDE_H = 0.75;
    NSE_H = 1;
    FTE_H = 7.05;
    PDE_V = 4;
    NSE_V = 1.5;
    FTE_V = 1.45;

    TSE_H = 2*sqrt(PDE_H^2+NSE_H^2+FTE_H^2);
    TSE_V = 2*sqrt(PDE_V^2+NSE_V^2+FTE_V^2);

    %% Generar todos los U-plan
    for i=1:length(tray_folder)
        %% Leer datos
        init_time = 0; % sale directamente de la base de datos como parámetro de cada flightplan
        wp=readtable(strcat(tray_folder,"\flight_plan_",num2str(i),".csv"));
        wp=[wp(:,1),wp(:,2),wp(:,3),wp(:,4)];
        wp.Properties.VariableNames = {'time', 'lat', 'lon', 'h'};
        %% Simplificación
        wp_reduced = wp(2:compression_factor:size(wp, 1), :);

        %% Generar BBOX y UPLAN
        bbox = generate_bbox(init_time, wp_reduced, TSE_H, TSE_V, 1, 5);
        generate_random_JSON(bbox, wp_reduced, strcat(uplan_folder,"\Uplan_",num2str(i),".json"))
    end