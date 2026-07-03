# Privacy Policy

**Last updated: July 3, 2026**

[TO BE COMPLETED: Business operator name (e.g., Clore LLC)] ("we," "us," or "the Company") provides the delivery operations support application "Rakuten Super Delivery App" (the "App"). We handle personal information in compliance with Japan's Act on the Protection of Personal Information ("APPI") and other applicable laws and guidelines, and we establish this Privacy Policy (this "Policy") as follows.

> ⚠️ This document is a template. All [TO BE COMPLETED] items must be filled in to match the actual business entity and operational practices. Legal review before publication is strongly recommended. In case of any discrepancy between this English version and the Japanese version, the Japanese version shall prevail.

---

## 1. Business Operator Information

| Item | Details |
|------|---------|
| Business operator | [TO BE COMPLETED: legal name] |
| Address | [TO BE COMPLETED] |
| Representative | [TO BE COMPLETED] |
| Personal Information Protection Manager | [TO BE COMPLETED: name / department] |
| Contact | [TO BE COMPLETED: email / phone] (e.g., riku@clorellc.jp) |

---

## 2. Personal Information We Collect

The App collects and handles the following personal information for the purpose of carrying out delivery operations.

### 2-1. Information about delivery recipients (customers)
- Name
- Address (and location data such as latitude/longitude derived via geocoding)
- Phone number
- Slip number (delivery No.) and dispatch number
- Delivery-related information such as items, quantities, and delivery status
- The above information contained in dispatch sheets (PDF, image, Excel, CSV, camera-captured images)

> Much of this delivery-recipient information includes data that we handle **under a service outsourcing arrangement** on behalf of the delivery client (the Rakuten group and the dispatch management system "CARIO"). See Section 6.

### 2-2. Information about drivers (employees / contracted crew)
- Name, affiliated company, assigned area, vehicle number
- Login email address and password (stored in hashed form)
- Location information during work (when the delivery-progress / tracking feature is used)
- Work-related information such as attendance, shifts, and extra-vehicle requests

### 2-3. Information collected automatically
- Access logs, operation logs, and audit logs (audit_logs: we **do not record the personal information values themselves**, such as name, phone number, address, or slip number — only the changed field names, processing type, and status)
- Cookies and session information (used solely for purposes such as maintaining login state)

---

## 3. Purposes of Use

We use collected personal information within the scope of the following purposes.

1. Receiving and performing delivery operations; dispatch, route planning, and delivery-progress management
2. Optical character recognition (OCR) ingestion and digitization of dispatch sheets (documents, images, etc.)
3. Map display, navigation, and coordinate correction for delivery addresses
4. Receiving extra-vehicle requests and communicating/reporting to relevant parties
5. Driver authentication, shift management, and work communication
6. Improving the App's quality, addressing defects, ensuring security, and responding to audits
7. Responding to legal requirements and protecting our rights and property

Except where we have obtained the individual's prior consent or where permitted by law, we do not use personal information beyond the scope of the purposes above.

---

## 4. Handling of Predicted / Estimated Values (Data Quality Policy)

The App treats OCR results, automatically corrected values, and coordinates from mapping APIs as **estimated values**, managed separately from confirmed values.

- Coordinates from Google Geocoding and similar sources are initially treated as "ESTIMATED."
- Only location information approved by an administrator is treated as "ADMIN_APPROVED" (confirmed), and is not overwritten by automated processing.
- Estimated / low-confidence values are clearly indicated in the UI to help prevent misdelivery.

---

## 5. Security Management Measures

To prevent leakage, loss, or damage of personal information and to otherwise manage it safely, we implement measures including the following.

- **Access control**: Authorization control based on role (administrator / driver). Drivers can view and update only the delivery information assigned to them.
- **Authentication**: Passwords are hashed using bcrypt. Authentication tokens are compared in a timing-safe manner.
- **Encryption in transit**: Encrypted communication via HTTPS, with security headers such as HSTS applied.
- **Log minimization**: Personal information values such as name, phone number, address, and slip number are not output to application logs. Such values are also not stored in audit logs.
- **Restriction of outbound requests**: To mitigate server-side request forgery (SSRF), image retrieval sources are restricted to our own storage.
- **Vulnerability and dependency monitoring**: Regular security reviews and monitoring of dependency vulnerabilities are conducted (`docs/SECURITY_AUDIT.md`).
- **Awareness of external environment**: Some personal data is stored and processed on cloud services outside Japan ([TO BE COMPLETED: e.g., the United States]). We understand the personal-information-protection framework of the relevant country and implement security management measures that take it into account.

---

## 6. Provision to Third Parties and Outsourcing

### 6-1. Provision to third parties
Except in the following cases, we do not provide personal information to third parties without obtaining the individual's prior consent.
- Where required by law
- Where necessary to protect a person's life, body, or property and it is difficult to obtain the individual's consent
- Where we exchange information with the delivery client (the Rakuten group, etc.) to the extent necessary to perform delivery operations

### 6-2. Outsourcing / use of external services (subcontractors)
To the extent necessary to achieve the purposes of use, we outsource the handling of personal information to the following external services. We exercise necessary and appropriate supervision over these subcontractors.

| Subcontractor / Service | Purpose | Main information handled |
|-------------------------|---------|--------------------------|
| CARIO (dispatch management system / Rakuten group) | Linking dispatch data; exchange of extra-vehicle requests | Delivery-recipient info, dispatch info, driver info |
| OCR.space | OCR of dispatch-sheet images | Dispatch-sheet images (including names, addresses, phone numbers, slip numbers, etc.) |
| Google (Geocoding / Maps API) | Address-to-coordinate conversion, map display, navigation | Delivery-recipient addresses |
| LINE (Messaging API) | Work communication / reporting such as extra-vehicle requests | Communication content (may include contact names, report text, etc.) |
| Vercel (hosting / Blob storage) | Operation of the App and storage of images, etc. | All information handled by the App |
| Database (PostgreSQL) | Storage of operational data | All information handled by the App |

---

## 7. Provision to Third Parties in Foreign Countries

Some of the subcontractors listed above (e.g., OCR.space, Google, LINE, Vercel) may have servers or business locations outside Japan, and personal information may therefore be handled abroad. In connection with provision to third parties in foreign countries, we take the measures required under the APPI (Article 28). In particular, optical character recognition (OCR) processing of dispatch-sheet images (which include names, addresses, phone numbers, slip numbers, etc.) may be performed by operators located outside Japan.

Where we obtain the individual's prior consent to provide personal information to a third party in a foreign country, we provide the following reference information.

| Recipient / Service | Main country / region | Protection information |
|---------------------|-----------------------|------------------------|
| OCR.space | [TO BE CONFIRMED: country / region] | Information on the country's personal-information-protection framework and the recipient's protection measures is available via the contact point |
| Google (Geocoding / Maps) | [TO BE CONFIRMED: mainly U.S., etc.] | Same as above |
| LINE (Messaging API) | [TO BE CONFIRMED] | Same as above |
| Vercel (hosting / Blob) | [TO BE CONFIRMED: mainly U.S., etc.] | Same as above |

- Details of the above countries/regions, the personal-information-protection framework of each country, and the protection measures taken by the recipient are also available upon request to the contact point (Section 12).
- Where a subcontractor has established a "system conforming to the standards," we will, based on that system, continuously ascertain the equivalent measures and provide information to the individual.

---

## 8. Retention Period

We retain personal information for the period necessary to achieve the purposes of use, or for the period required by law, and we promptly delete or anonymize such information once that period has elapsed.

- Delivery-related information: retained for [TO BE COMPLETED: period (e.g., X years)] after completion of delivery operations
- Driver account information: retained for [TO BE COMPLETED: period] after termination of the contract/use
- Dispatch-sheet images collected for OCR: deleted after [TO BE COMPLETED: period]

---

## 9. Rights of the Individual (Disclosure, Correction, Suspension of Use, etc.)

Individuals may request notification of the purpose of use, disclosure, correction, addition, deletion, suspension of use, or suspension of provision to third parties of their own retained personal data held by us. Please contact the contact point (Section 12). In accordance with the law, and after verifying identity, we will respond within a reasonable period.

- **Fees**: [TO BE COMPLETED: whether a fee applies to disclosure requests and, if so, the amount. If free, state "no charge."]
- For delivery-recipient information that we handle under outsourcing from the delivery client, the procedures established by the client may apply; in such cases, we may direct the request to the client.

---

## 10. Use of Cookies

The App uses cookies and session information for purposes such as maintaining login state. These are used only to the extent necessary to provide the App's functionality and are not used for advertising tracking.

---

## 11. Amendments to This Policy

We may amend this Policy in response to changes in law or reviews of our operations. When we make material changes, we will notify users by appropriate means, such as posting within the App. The amended Policy takes effect from the time it is posted in the App.

---

## 12. Contact

For inquiries or **complaints** regarding this Policy or the handling of personal information, please contact us below.

- Business operator: [TO BE COMPLETED]
- Contact (complaints desk): [TO BE COMPLETED: department / name]
- Email: [TO BE COMPLETED: e.g., riku@clorellc.jp]
- Hours: [TO BE COMPLETED]

You may also consult the Personal Information Protection Commission (PPC) of Japan regarding the handling of personal information.

---

### Appendix: Checklist of items to complete
- [ ] Business operator name, address, representative, protection manager (Section 1)
- [ ] Contact details for inquiries (Sections 1 & 12)
- [ ] Data-storage country/region of each subcontractor (Section 7)
- [ ] Retention periods for each data type (Section 8)
- [ ] Legal review before publication
