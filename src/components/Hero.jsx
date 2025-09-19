import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const HeroSection = styled.section`
  position: absolute;
  top: 80px; left: 0; width: 100%;
  text-align: center; pointer-events: none;
`;

const Title = styled.h2`
  margin: 0; font-size: 2.5rem; font-weight: 700; color: #333;
`;

const Subtitle = styled.p`
  margin-top: 0.5rem; font-size: 1.2rem; font-weight: 300; color: #555;
`;

export default function Hero() {
  const { t } = useTranslation();
  return (
    <HeroSection>
      <Title>{t('whatWeOffer')}</Title>
      <Subtitle>{t('offerText')}</Subtitle>
    </HeroSection>
  );
}
