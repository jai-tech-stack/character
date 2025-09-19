import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const Overlay = styled.div`
  position:absolute; bottom:18%; left:5%;
  background:rgba(255,255,255,0.9);
  border-radius:8px; padding:1.5rem 2rem;
  max-width:350px; z-index:50;
  box-shadow:0 2px 8px rgba(0,0,0,0.1);
`;

const Heading = styled.h3`
  margin:0 0 0.5rem; font-weight:700;
`;

const Text = styled.p`
  margin:0 0 1rem; color:#555; font-weight:300;
`;

const Button = styled.button`
  background:#ff7f50; color:white;
  border:none; padding:0.6rem 1.2rem;
  border-radius:20px; font-weight:500;
`;

export default function OverlayInfo() {
  const { t } = useTranslation();
  return (
    <Overlay>
      <Heading>{t('whatWeOffer')}</Heading>
      <Text>{t('offerText')}</Text>
      <Button>{t('exploreWork')}</Button>
    </Overlay>
  );
}
