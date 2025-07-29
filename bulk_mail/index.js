const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// POST /send-csv-emails
app.post("/send-csv-emails", upload.single("recipients"), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      fs.unlinkSync(req.file.path); // remove uploaded CSV file
      
      try {
        for (const row of results) {
            const toEmail = row.email?.trim(); // <- trim to remove whitespace
            if (!toEmail) {
                console.warn("Missing or invalid email in row:", row);
                continue; // skip this row
            }
          const msg = {
            to: row.email,
            cc: [process.env.SENDER_EMAIL],
            from: {
              email: process.env.CC_MAIL,
              name: process.env.SENDER_NAME,
            },
            replyTo: {
              email: process.env.SENDER_EMAIL,
              name: process.env.SENDER_NAME,
            },
            templateId: process.env.TEMPLATE_ID,
            dynamicTemplateData: {
              first_name: row.name,
              subject: process.env.MAIL_SUBJECT,
            },
            mailSettings: {
              subscription_tracking: {
                enable: false,
              },
            },
          };

          await sgMail.send(msg); // serial await avoids duplication
        }

        res.status(200).json({ message: "Bulk emails sent successfully" });
      } catch (error) {
        console.error("SendGrid error:", error.response?.body || error.message);
        res.status(500).json({ error: "Failed to send emails" });
      }
    });

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
