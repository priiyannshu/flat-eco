import { jsPDF } from 'jspdf';
import { ReceiptRecord, UserProfile } from '../types';

export function generateReceiptPDF(
  receipt: ReceiptRecord,
  tenant: UserProfile,
  ownerName: string = 'Apartment Caretaker',
  flatName: string = 'Bachelor Apartment 402',
  upiId: string = 'owner@upi'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 format: clean, modern receipt size perfect for mobile and printing
  });

  // Colors
  const primaryColor = [22, 163, 74]; // Emerald green
  const darkColor = [30, 41, 59];
  const grayColor = [100, 116, 139];
  const lightBg = [248, 250, 252];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 148, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FLAT-ECO EXPENSE RECEIPT', 74, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(flatName + ' • Monthly Ledger & Food Receipt', 74, 19, { align: 'center' });

  // Receipt Meta Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(10, 33, 128, 24, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, 33, 128, 24, 3, 3, 'D');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Receipt No:', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.id, 37, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Month:', 85, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.month, 102, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Tenant:', 14, 47);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tenant.name} (${tenant.room_or_info || 'Resident'})`, 32, 47);

  doc.setFont('helvetica', 'bold');
  doc.text('Date Issued:', 85, 47);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date(receipt.issued_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  doc.text(dateStr, 108, 47);

  doc.setFont('helvetica', 'bold');
  doc.text('Owner / Caretaker:', 14, 53);
  doc.setFont('helvetica', 'normal');
  doc.text(`${ownerName} (${upiId})`, 48, 53);

  // Table Header
  const tableStartY = 64;
  doc.setFillColor(241, 245, 249);
  doc.rect(10, tableStartY, 128, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('#', 14, tableStartY + 5.5);
  doc.text('ITEM / DESCRIPTION', 22, tableStartY + 5.5);
  doc.text('QTY / RATE', 92, tableStartY + 5.5);
  doc.text('AMOUNT (INR)', 132, tableStartY + 5.5, { align: 'right' });

  // Rows
  const items = [
    {
      num: '1',
      title: 'Flat Rent Share',
      sub: `Room accommodation for ${receipt.month}`,
      qty: '1 Month',
      amt: receipt.rent_amount
    },
    {
      num: '2',
      title: 'Tiffin Meals Consumed',
      sub: `${receipt.tiffin_count} meals recorded & ticked`,
      qty: `${receipt.tiffin_count} @ ₹60`,
      amt: receipt.tiffin_amount
    },
    {
      num: '3',
      title: 'Electricity Bill Split',
      sub: 'Shared flat utility share (1/4th)',
      qty: 'Flat share',
      amt: receipt.electricity_amount
    }
  ];

  if (receipt.extras_amount > 0) {
    items.push({
      num: '4',
      title: 'Extra Meals / Items',
      sub: 'Guest / extra tiffins charged',
      qty: `${Math.round(receipt.extras_amount / 60)} @ ₹60`,
      amt: receipt.extras_amount
    });
  }

  let curY = tableStartY + 9;
  items.forEach((item, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(8.5);
    doc.text(item.num, 14, curY + 4);

    doc.setFont('helvetica', 'bold');
    doc.text(item.title, 22, curY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(item.sub, 22, curY + 8);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(8);
    doc.text(item.qty, 92, curY + 4);

    doc.setFont('helvetica', 'bold');
    doc.text(`₹${item.amt.toFixed(2)}`, 132, curY + 4, { align: 'right' });

    // Divider
    curY += 12;
    doc.setDrawColor(241, 245, 249);
    doc.line(10, curY, 138, curY);
    curY += 2;
  });

  // Total Section
  curY += 4;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(70, curY, 68, 18, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(70, curY, 68, 18, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('TOTAL AMOUNT:', 74, curY + 7);

  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`₹${receipt.total_amount.toFixed(2)}`, 134, curY + 13, { align: 'right' });

  // Paid Stamp / Seal
  curY += 24;
  const isSettled = receipt.status === 'settled';
  const stampColor = isSettled ? [22, 163, 74] : [234, 88, 12];
  doc.setDrawColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.setLineWidth(0.8);
  doc.rect(14, curY, 40, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.text(isSettled ? 'PAID & VERIFIED' : 'ISSUED / PENDING', 34, curY + 8.5, { align: 'center' });

  // Signature Block
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(95, curY + 10, 135, curY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Authorized Sign / Caretaker', 115, curY + 14, { align: 'center' });

  // Footer Note
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is an electronically generated receipt verified on FlatEco.',
    74,
    202,
    { align: 'center' }
  );

  return doc;
}

export function downloadReceiptPDF(receipt: ReceiptRecord, tenant: UserProfile) {
  const doc = generateReceiptPDF(receipt, tenant);
  doc.save(`FlatEco_Receipt_${receipt.month}_${tenant.name.replace(/\s+/g, '_')}.pdf`);
}
