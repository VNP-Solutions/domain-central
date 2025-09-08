const { google } = require('googleapis');
const SmsMessage = require('../models/SmsMessage');

class GmailAPI {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            `${process.env.BASE_URL || 'http://localhost:3000'}/oauth2callback`
        );
        
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        
        // Scopes required for reading Gmail messages
        this.scopes = [
            'https://www.googleapis.com/auth/gmail.readonly'
        ];
    }

    // Generate OAuth2 authorization URL
    generateAuthUrl() {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.scopes,
            prompt: 'consent' // Force consent screen to get refresh token
        });
    }

    // Exchange authorization code for tokens
    async getTokens(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error);
            throw new Error('Failed to exchange authorization code for tokens');
        }
    }

    // Set stored tokens
    setTokens(tokens) {
        this.oauth2Client.setCredentials(tokens);
    }

    // Refresh access token
    async refreshTokens() {
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);
            return credentials;
        } catch (error) {
            console.error('Error refreshing tokens:', error);
            throw new Error('Failed to refresh access token');
        }
    }

    // Get messages from specific sender
    async getMessagesFromSender(senderEmail = 'sms@rebelforce.tech', maxResults = 50) {
        try {
            const query = `from:${senderEmail}`;
            
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: maxResults
            });

            const messages = response.data.messages || [];
            console.log(`Found ${messages.length} messages from ${senderEmail}`);
            
            return messages;
        } catch (error) {
            console.error('Error fetching messages:', error);
            throw new Error('Failed to fetch messages from Gmail');
        }
    }

    // Get full message details
    async getMessage(messageId) {
        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching message details:', error);
            throw new Error(`Failed to fetch message ${messageId}`);
        }
    }

    // Parse SMS content from email body
    parseSmsFromEmail(emailBody) {
        try {
            console.log('Parsing email body:', emailBody.substring(0, 200) + '...');
            
            // Look for the pattern: SMS content, then "From" line, then date
            const lines = emailBody.split('\n').map(line => line.trim()).filter(line => line);
            
            let smsContent = '';
            let sender = '';
            let receivedDate = new Date(); // Default to current date
            
            // Find the "From" line to identify the sender
            const fromLineIndex = lines.findIndex(line => line.startsWith('From '));
            
            if (fromLineIndex === -1) {
                console.warn('Could not find sender information in email, using full body as SMS content');
                return {
                    smsContent: emailBody.trim(),
                    sender: 'Unknown',
                    receivedDate: new Date(),
                    rawDateString: '',
                    success: false,
                    error: 'No sender information found'
                };
            }
            
            // Everything before the "From" line is SMS content
            smsContent = lines.slice(0, fromLineIndex).join('\n').trim();
            
            // Extract sender from the "From" line
            const fromLine = lines[fromLineIndex];
            console.log('From line:', fromLine);
            
            // Pattern: "From My Private Phone +14152861443"
            const phoneMatch = fromLine.match(/\+?\d[\d\s\-\(\)]+/);
            sender = phoneMatch ? phoneMatch[0].replace(/[\s\-\(\)]/g, '') : 'Unknown';
            
            // Extract date from the line after "From"
            let rawDateString = '';
            if (fromLineIndex + 1 < lines.length) {
                const dateLine = lines[fromLineIndex + 1];
                rawDateString = dateLine; // Store the raw date string
                console.log('Date line:', dateLine);
                
                // Try multiple date parsing strategies
                let parsedDate = null;
                
                // Strategy 1: Look for "Month Day, Year at Time" format
                let dateMatch = dateLine.match(/([A-Za-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2}[AP]M)/);
                if (dateMatch) {
                    parsedDate = new Date(dateMatch[1]);
                    console.log('Parsed date (strategy 1):', parsedDate);
                }
                
                // Strategy 2: Look for any date-like pattern
                if (!parsedDate || isNaN(parsedDate.getTime())) {
                    dateMatch = dateLine.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        parsedDate = new Date(dateMatch[1]);
                        console.log('Parsed date (strategy 2):', parsedDate);
                    }
                }
                
                // Strategy 3: Try parsing the entire line as a date
                if (!parsedDate || isNaN(parsedDate.getTime())) {
                    parsedDate = new Date(dateLine);
                    console.log('Parsed date (strategy 3):', parsedDate);
                }
                
                // Only use the parsed date if it's valid
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    receivedDate = parsedDate;
                } else {
                    console.warn('Could not parse date from:', dateLine, 'using current date');
                }
            }
            
            console.log('Final parsed data:', { smsContent: smsContent.substring(0, 50) + '...', sender, receivedDate });
            
            return {
                smsContent,
                sender,
                receivedDate,
                rawDateString,
                success: true
            };
        } catch (error) {
            console.error('Error parsing SMS from email:', error);
            return {
                smsContent: emailBody.trim(),
                sender: 'Unknown',
                receivedDate: new Date(),
                rawDateString: '',
                success: false,
                error: error.message
            };
        }
    }

    // Decode base64 email body
    decodeEmailBody(payload) {
        let body = '';
        
        if (payload.body && payload.body.data) {
            // Direct body data
            body = Buffer.from(payload.body.data, 'base64').toString();
        } else if (payload.parts) {
            // Multi-part message, find text/plain part
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                }
            }
        }
        
        return body;
    }

    // Sync SMS messages from Gmail to database
    async syncSmsMessages(senderEmail = 'sms@rebelforce.tech') {
        try {
            console.log(`Starting SMS sync from ${senderEmail}...`);
            
            // Get messages from Gmail
            const messages = await this.getMessagesFromSender(senderEmail);
            
            let newMessages = 0;
            let errors = 0;
            
            for (const message of messages) {
                try {
                    // Check if message already exists
                    const existingMessage = await SmsMessage.findOne({ messageId: message.id });
                    if (existingMessage) {
                        continue; // Skip if already processed
                    }
                    
                    // Get full message details
                    const fullMessage = await this.getMessage(message.id);
                    
                    // Extract email body
                    const emailBody = this.decodeEmailBody(fullMessage.payload);
                    if (!emailBody) {
                        console.warn(`No body found for message ${message.id}`);
                        continue;
                    }
                    
                    // Parse SMS content
                    const parsedSms = this.parseSmsFromEmail(emailBody);
                    
                    // Get email date
                    const gmailDate = new Date(parseInt(fullMessage.internalDate));
                    
                    // Get subject
                    const subjectHeader = fullMessage.payload.headers.find(h => h.name === 'Subject');
                    const subject = subjectHeader ? subjectHeader.value : 'No Subject';
                    
                    // Use Gmail date as the primary date since it's more reliable
                    const validGmailDate = gmailDate && !isNaN(gmailDate.getTime()) 
                        ? gmailDate 
                        : new Date();
                    
                    // Use Gmail date for both receivedDate and gmailDate for consistency
                    // This ensures reliable timestamps instead of trying to parse dates from SMS content
                    const validReceivedDate = validGmailDate;
                    
                    console.log(`Message ${message.id}: Gmail date = ${validGmailDate.toISOString()}, Parsed date = ${parsedSms.receivedDate ? parsedSms.receivedDate.toISOString() : 'invalid'}`);
                    
                    // Save to database
                    const smsMessage = new SmsMessage({
                        messageId: message.id,
                        threadId: message.threadId,
                        subject: subject,
                        sender: parsedSms.sender,
                        smsContent: parsedSms.smsContent,
                        receivedDate: validReceivedDate,
                        gmailDate: validGmailDate,
                        receivedDateString: parsedSms.rawDateString || '',
                        rawEmailBody: emailBody,
                        isRead: false
                    });
                    
                    await smsMessage.save();
                    newMessages++;
                    
                    console.log(`Saved SMS from ${parsedSms.sender}: ${parsedSms.smsContent.substring(0, 50)}...`);
                    
                } catch (error) {
                    console.error(`Error processing message ${message.id}:`, error);
                    errors++;
                }
            }
            
            console.log(`SMS sync completed: ${newMessages} new messages, ${errors} errors`);
            
            return {
                success: true,
                newMessages,
                totalMessages: messages.length,
                errors
            };
            
        } catch (error) {
            console.error('Error syncing SMS messages:', error);
            throw new Error('Failed to sync SMS messages');
        }
    }

    // Get SMS messages from database
    async getSmsMessages(limit = 50, offset = 0) {
        try {
            const messages = await SmsMessage.find()
                .sort({ receivedDate: -1 })
                .limit(limit)
                .skip(offset);
            
            const total = await SmsMessage.countDocuments();
            
            return {
                messages,
                total,
                hasMore: offset + limit < total
            };
        } catch (error) {
            console.error('Error fetching SMS messages:', error);
            throw new Error('Failed to fetch SMS messages');
        }
    }

    // Mark message as read
    async markAsRead(messageId) {
        try {
            await SmsMessage.findOneAndUpdate(
                { messageId: messageId },
                { isRead: true },
                { new: true }
            );
            return true;
        } catch (error) {
            console.error('Error marking message as read:', error);
            return false;
        }
    }
}

module.exports = new GmailAPI();
