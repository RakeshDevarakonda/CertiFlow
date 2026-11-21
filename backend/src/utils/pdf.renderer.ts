import PDFDocument from 'pdfkit';

export interface CertificatePdfData {
  certificateNumber: string;
  verificationCode: string;
  candidateName: string;
  courseName: string;
  centreName: string;
  district: string;
  state: string;
  issuedAt: Date;
  status: 'ISSUED' | 'CANCELLED';
  cancellationReason?: string | null;
}

export class CertificatePdfRenderer {
  /**
   * Generates a sleek, professional PDF Certificate of Skill Completion
   * Features prominent Certificate Number & Verification Box for third-party auditing
   */
  static async renderToBuffer(data: CertificatePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Landscape A4 certificate (841.89 x 595.28 points)
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const width = doc.page.width;
      const height = doc.page.height;

      // 1. Double Decorative Borders
      doc.rect(18, 18, width - 36, height - 36)
        .lineWidth(3)
        .strokeColor('#1E3A8A') // Deep Navy
        .stroke();

      doc.rect(24, 24, width - 48, height - 48)
        .lineWidth(1)
        .strokeColor('#D97706') // Gold
        .stroke();

      // Corner accent triangles/boxes
      doc.rect(18, 18, 25, 25).fillColor('#1E3A8A').fill();
      doc.rect(width - 43, 18, 25, 25).fillColor('#1E3A8A').fill();
      doc.rect(18, height - 43, 25, 25).fillColor('#1E3A8A').fill();
      doc.rect(width - 43, height - 43, 25, 25).fillColor('#1E3A8A').fill();

      // 2. Top Bar: Prominent Certificate No & Verification Badge
      // Top Left: Certificate Number Badge
      doc.rect(40, 36, 260, 26)
        .fillColor('#F3F4F6')
        .fill();
      doc.rect(40, 36, 260, 26)
        .lineWidth(1)
        .strokeColor('#E5E7EB')
        .stroke();

      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#4B5563')
        .text('CERTIFICATE NUMBER:', 50, 42);
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text(data.certificateNumber, 155, 42);

      // Top Right: Verification Code Badge Box
      doc.rect(width - 300, 36, 260, 26)
        .fillColor('#FEF3C7') // Light Gold tint
        .fill();
      doc.rect(width - 300, 36, 260, 26)
        .lineWidth(1)
        .strokeColor('#F59E0B')
        .stroke();

      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#92400E')
        .text('VERIFICATION CODE:', width - 290, 42);
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#B45309')
        .text(data.verificationCode, width - 185, 42);

      // 3. Official Mission Header
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#D97706')
        .text('PRAGATI SKILLS MISSION', 0, 78, { align: 'center' });

      doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('GOVERNMENT OF MAHARASHTRA • SKILL DEVELOPMENT & EMPLOYMENT INITIATIVE', 0, 96, { align: 'center' });

      // 4. Certificate Title
      doc.fontSize(26)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text('CERTIFICATE OF SKILL COMPETENCY', 0, 125, { align: 'center' });

      doc.fontSize(11)
        .font('Helvetica-Oblique')
        .fillColor('#6B7280')
        .text('This credential is state-certified and proudly presented to', 0, 162, { align: 'center' });

      // 5. Candidate Name
      doc.fontSize(26)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(data.candidateName, 0, 185, { align: 'center' });

      // Gold Accent line under candidate name
      const nameWidth = doc.widthOfString(data.candidateName);
      const startX = (width - Math.min(nameWidth + 80, 450)) / 2;
      doc.moveTo(startX, 220)
        .lineTo(startX + Math.min(nameWidth + 80, 450), 220)
        .lineWidth(1.5)
        .strokeColor('#D97706')
        .stroke();

      // 6. Course & Training Partner
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text('for successful completion and qualification under national curriculum standards in', 0, 235, { align: 'center' });

      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text(data.courseName, 0, 255, { align: 'center' });

      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(`Training Partner: ${data.centreName}  •  District: ${data.district}, ${data.state}`, 0, 280, { align: 'center' });

      // 7. Middle Big Verification Callout Box (For employers & verifiers)
      const boxWidth = 520;
      const boxHeight = 44;
      const boxX = (width - boxWidth) / 2;
      const boxY = 315;

      doc.rect(boxX, boxY, boxWidth, boxHeight)
        .fillColor('#F9FAFB')
        .fill();
      doc.rect(boxX, boxY, boxWidth, boxHeight)
        .lineWidth(1)
        .strokeColor('#D1D5DB')
        .stroke();

      doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text('OFFICIAL CREDENTIAL VERIFICATION', boxX + 15, boxY + 8);

      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(`Certificate No: ${data.certificateNumber}   •   Verification Code: `, boxX + 15, boxY + 24);

      doc.font('Helvetica-Bold')
        .fillColor('#B45309')
        .text(data.verificationCode, boxX + 270, boxY + 24);

      doc.font('Helvetica')
        .fillColor('#6B7280')
        .text('   •   State Public Portal', boxX + 360, boxY + 24);

      // 8. Watermark & Warning if Cancelled
      if (data.status === 'CANCELLED') {
        doc.save();
        doc.rotate(-25, { origin: [width / 2, height / 2] });
        doc.fontSize(55)
          .font('Helvetica-Bold')
          .fillColor('#DC2626')
          .fillOpacity(0.18)
          .text('OFFICIALLY CANCELLED', (width / 2) - 300, (height / 2) - 30, { align: 'center' });
        doc.restore();

        // Cancellation Alert Banner
        doc.rect(40, height - 105, width - 80, 26)
          .fillColor('#FEE2E2')
          .fill();

        doc.fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#B91C1C')
          .text(`REVOCATION NOTICE: This certificate has been CANCELLED. Reason: ${data.cancellationReason || 'Administrative revocation'}`, 50, height - 97, { align: 'center' });
      }

      // 9. Official Sign-Off Footer
      const formattedDate = new Date(data.issuedAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const footerY = height - 65;

      // Left: Date of Issue
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(`Date of Issue: ${formattedDate}`, 45, footerY);
      doc.fontSize(8)
        .fillColor('#9CA3AF')
        .text('Pragati Digital Seal Certified', 45, footerY + 14);

      // Center: Seal
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text('PRAGATI SKILLS MISSION', 0, footerY, { align: 'center' });
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('State Competency Registry', 0, footerY + 14, { align: 'center' });

      // Right: State Director Authority
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text('DIRECTOR OF SKILL DEVELOPMENT', width - 260, footerY, { align: 'right' });
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('Government of Maharashtra', width - 260, footerY + 14, { align: 'right' });

      doc.end();
    });
  }
}
