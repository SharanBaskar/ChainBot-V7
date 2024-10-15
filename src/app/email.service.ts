// email.service.ts
import { Injectable } from '@angular/core';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

@Injectable({
  providedIn: 'root'
})
export class EmailService {

  constructor() { }

  sendEmail(templateParams: any): Promise<EmailJSResponseStatus> {
    const serviceId = 'service_xtcg508'; // Replace with your EmailJS service ID
    const templateId = 'template_ky3ydpp'; // Replace with your EmailJS template ID
    const userId = 'QVAF5IuB_-FAI3Hzm'; // Replace with your EmailJS user ID

    return emailjs.send(serviceId, templateId, templateParams, userId);
  }
}
