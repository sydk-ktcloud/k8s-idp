import { useEffect, useState } from 'react';
import {
  Map,
  MapMarker,
  MapTypeControl,
  ZoomControl,
} from 'react-kakao-maps-sdk';

import { COLORS } from '../../../styles/Colors';

interface ProductMapProps {
  addr: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface KakaoGeocoderResult {
  x: string;
  y: string;
  address_name: string;
}

declare global {
  interface Window {
    kakao: {
      maps: {
        services: {
          Geocoder: new () => {
            addressSearch: (
              address: string,
              callback: (result: KakaoGeocoderResult[], status: string) => void,
            ) => void;
          };
          Status: {
            OK: string;
          };
        };
      };
    };
  }
}

export default function ProductMap({ addr }: ProductMapProps) {
  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: 33.450701,
    lng: 126.570667,
  });

  useEffect(() => {
    if (!addr || !window.kakao?.maps?.services) {
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.addressSearch(
      addr,
      (result: KakaoGeocoderResult[], status: string) => {
        if (
          status === window.kakao.maps.services.Status.OK &&
          result.length > 0
        ) {
          const coords = {
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x),
          };
          setCoordinates(coords);
        }
      },
    );
  }, [addr]);

  const handleMapClick = () => {
    const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`;
    window.open(kakaoMapUrl, '_blank');
  };

  return (
    <div className='mb-8'>
      <div className='mb-4'>
        <div
          className='mb-2 text-lg font-semibold'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          위치 정보
        </div>
        <div style={{ color: COLORS.TEXT_SUB }}>{addr}</div>
      </div>

      <Map
        id='map'
        className='cursor-pointer'
        center={coordinates}
        onClick={handleMapClick}
        style={{
          width: '100%',
          height: '350px',
          borderRadius: '15px',
        }}
        level={3}
      >
        <MapMarker position={coordinates} />
        <MapTypeControl position={'TOPRIGHT'} />
        <ZoomControl position={'RIGHT'} />
      </Map>

      <div
        className='flex justify-end mt-2 font-medium text-[12px]'
        style={{ color: COLORS.REQUIRED }}
      >
        클릭하시면 카카오맵에서 위치를 확인할 수 있습니다
      </div>
    </div>
  );
}
