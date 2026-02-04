function bbox = generate_bbox(init_time, wp, TSE_H, TSE_V, Alpha, tbuf)

bbox = struct();

for i=1:(length(wp.lat)-1)
    [dist,a12]=vincenty_distazi(wp.lat(i),wp.lon(i),wp.lat(i+1),wp.lon(i+1));
    if ((dist < 1) || (isnan(dist)))
    dist = 0.01;
    a12 = 0;
    end
    bbox.N(i) = ceil(dist/(Alpha*TSE_H));
    dist_aux=dist/bbox.N(i);
    dist_aux_vert=(wp.h(i+1)-wp.h(i))/bbox.N(i);
    tiempo_tramo=(wp.time(i+1)-wp.time(i))/bbox.N(i);
    wp_aux(1,:)=[wp.lat(i),wp.lon(i),wp.h(i),wp.time(i)];
    wp_aux(bbox.N(i)+1,:)=[wp.lat(i+1),wp.lon(i+1),wp.h(i+1),wp.time(i+1)];
    [wp_aux_medio(1,1),wp_aux_medio(1,2)]=vincenty_reckon(wp.lat(i),wp.lon(i),dist_aux/2,a12);
    wp_aux_medio(1,3)=wp.h(i)+dist_aux_vert/2;

    for k=2:bbox.N(i)
        [wp_aux(k,1),wp_aux(k,2)] = vincenty_reckon(wp_aux(k-1,1),wp_aux(k-1,2),dist_aux,a12);
        wp_aux(k,3) = wp_aux(k-1,3) + dist_aux_vert;
        wp_aux(k,4) = wp_aux(k-1,4) + tiempo_tramo;
        [wp_aux_medio(k,1),wp_aux_medio(k,2)] = vincenty_reckon(wp_aux_medio(k-1,1),wp_aux_medio(k-1,2),dist_aux,a12);
        wp_aux_medio(k,3) = wp_aux_medio(k-1,3)+dist_aux_vert;
    end

    for k=1:bbox.N(i)
        [lat1,lon1]=vincenty_reckon(wp_aux_medio(k,1),wp_aux_medio(k,2),sqrt(2)*TSE_H,a12+45);
        [lat2,lon2]=vincenty_reckon(wp_aux_medio(k,1),wp_aux_medio(k,2),sqrt(2)*TSE_H,a12+45+90);
        [lat3,lon3]=vincenty_reckon(wp_aux_medio(k,1),wp_aux_medio(k,2),sqrt(2)*TSE_H,a12+45+180);
        [lat4,lon4]=vincenty_reckon(wp_aux_medio(k,1),wp_aux_medio(k,2),sqrt(2)*TSE_H,a12+45+270);
        bbox.alt{i, k} = [wp_aux_medio(k,3) + TSE_V ,  wp_aux_medio(k,3) - TSE_V];
        bbox.bbox{i, k} = [lat1, mod(lon1 + 180, 360) - 180; lat2, mod(lon2 + 180, 360) - 180; lat3, mod(lon3 + 180, 360) - 180; lat4, mod(lon4 + 180, 360) - 180; lat1, mod(lon1 + 180, 360) - 180];
        if wp_aux(k,4) > 1000000
        bbox.time{i,k} = [wp_aux(k,4) - tbuf, wp_aux(k+1,4) + tbuf]; % Este + está puesto post-tfg
        else
        bbox.time{i,k} = [init_time + wp_aux(k,4)/100 - tbuf, init_time + wp_aux(k+1,4)/100 + tbuf]; % Este + está puesto post-tfg
        end
    end

end


end