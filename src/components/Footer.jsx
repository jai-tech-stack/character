import React from 'react';
import styled from 'styled-components';

const Foot = styled.footer`
  position:absolute; bottom:0; left:0; width:100%;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(8px); padding:1.5rem 2rem;
  text-align:center; font-weight:300; z-index:50;
`;

export default function Footer() {
  return (
    <Foot>
      <p>Origami Creative Pvt Ltd</p>
      <p>Building sticky tribes™</p>
      <p>Contact us at hello@origamicreative.com</p>
    </Foot>
  );
}
